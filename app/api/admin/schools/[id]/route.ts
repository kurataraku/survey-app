import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { sanitizeCampusLocationsInput } from '@/lib/schools/campusLocations';
import { normalizeText } from '@/lib/utils';
import { syncRagForSchoolIds } from '@/lib/rag/sync';
import { normalizeSlugValue, recordSchoolSlugHistory } from '@/lib/schools/slug-history';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 学校を取得（非公開含む）
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    after(async () => {
      try {
        await syncRagForSchoolIds([id]);
      } catch (syncError) {
        console.error('[admin/schools/:id] RAG同期エラー:', syncError);
      }
    });

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const {
      name,
      prefecture,
      prefectures,
      institution_type,
      campus_locations,
      slug,
      intro,
      highlights,
      faq,
      official_url,
      is_public,
      status,
    } = body;

    // バリデーション
    if (!name || !prefecture || !slug) {
      return NextResponse.json(
        { error: '学校名、都道府県、スラッグは必須です' },
        { status: 400 }
      );
    }

    // prefectures配列を準備（prefecturesが指定されていない場合はprefectureから作成）
    const prefecturesArray = prefectures && Array.isArray(prefectures) && prefectures.length > 0
      ? prefectures
      : [prefecture];
    const campusLocationsArray = sanitizeCampusLocationsInput(campus_locations);

    // 学校名の重複チェック（自分自身を除く）
    const { data: nameConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .neq('id', id)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'この学校名は既に使用されています' },
        { status: 400 }
      );
    }

    const nameNormalized = normalizeText(name);
    const { data: normalizedConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name_normalized', nameNormalized)
      .neq('id', id)
      .maybeSingle();

    if (normalizedConflict) {
      return NextResponse.json(
        { error: 'この学校名は既存校と正規化後に同一になるため登録できません（表記を変えてください）' },
        { status: 400 }
      );
    }

    const { data: currentSchool } = await supabase
      .from('schools')
      .select('name, status, slug')
      .eq('id', id)
      .single();

    // スラッグの重複チェック（自分自身を除く）
    const { data: slugConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (slugConflict) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 学校情報を更新
    const updateData: Record<string, unknown> = {
      name,
      name_normalized: nameNormalized,
      prefecture,
      prefectures: prefecturesArray,
      institution_type: institution_type || null,
      campus_locations: campusLocationsArray,
      slug,
      intro: intro || null,
      highlights: highlights || null,
      faq: faq || null,
      is_public: is_public !== undefined ? is_public : true,
    };

    // official_url が指定されている場合のみ更新（http/https のみ許可）
    if (official_url !== undefined) {
      const trimmedUrl = typeof official_url === 'string' ? official_url.trim() : '';
      if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
        return NextResponse.json(
          { error: '公式サイトURLは http:// または https:// で始まる必要があります' },
          { status: 400 }
        );
      }
      updateData.official_url = trimmedUrl || null;

      // 管理画面（人間）からの保存はURLを確認済みとして確定する。
      // エージェント（AGENT_API_KEY）経由の場合は確定扱いにしない。
      const isHuman = authResult.adminUser.id !== 'agent';
      if (trimmedUrl) {
        if (isHuman) {
          updateData.official_url_verified = true;
          updateData.official_url_source = 'manual';
        }
      } else {
        updateData.official_url_verified = false;
        updateData.official_url_source = null;
      }
    }
    
    // statusが指定されている場合は更新に含める
    if (status !== undefined) {
      updateData.status = status;
    }

    // statusが'pending'から'active'に変更される場合、school_nameで紐づいている口コミのschool_idを更新
    if (status === 'active') {
      // 現在のstatusが'pending'の場合、school_nameで紐づいている口コミのschool_idを更新
      if (currentSchool && currentSchool.status === 'pending') {
        // school_nameで紐づいているが、school_idがnullの口コミを更新
        const { error: updateReviewsError } = await supabase
          .from('survey_responses')
          .update({ school_id: id })
          .eq('school_name', currentSchool.name)
          .is('school_id', null)
          .select('id');

        if (updateReviewsError) {
          console.error('口コミ紐づけエラー:', updateReviewsError);
          // エラーが発生しても続行（学校の更新は実行される）
        }
      }
    }

    const { data: school, error: updateError } = await supabase
      .from('schools')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('学校更新エラー:', updateError);
      return NextResponse.json(
        { error: '学校情報の更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    const previousSlug = normalizeSlugValue(currentSchool?.slug);
    const nextSlug = normalizeSlugValue(slug);
    if (previousSlug && nextSlug && previousSlug !== nextSlug) {
      await recordSchoolSlugHistory(supabase, {
        schoolId: id,
        oldSlug: previousSlug,
        reason: 'manual_update',
      });
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}





