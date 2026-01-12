import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/admin';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/**
 * 管理者情報を更新（role変更、is_active変更）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireOwner(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const adminSupabase = createAdminSupabaseClient();
    const body = await request.json();
    const { role, is_active } = body;

    // 更新するデータを準備
    const updateData: any = {};
    if (role !== undefined) {
      if (role !== 'owner' && role !== 'admin') {
        return NextResponse.json(
          { error: 'roleはownerまたはadminである必要があります' },
          { status: 400 }
        );
      }
      updateData.role = role;
    }
    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return NextResponse.json(
          { error: 'is_activeはboolean型である必要があります' },
          { status: 400 }
        );
      }
      updateData.is_active = is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新するデータが指定されていません' },
        { status: 400 }
      );
    }

    // 現在の状態を取得
    const { data: currentAdminUser } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentAdminUser) {
      return NextResponse.json(
        { error: '管理者が見つかりません' },
        { status: 404 }
      );
    }

    // 最後のownerを無効化またはrole変更しようとする場合をチェック
    if (updateData.role === 'admin' || (updateData.is_active === false && currentAdminUser.role === 'owner')) {
      const { count: ownerCount, error: countError } = await adminSupabase
        .from('admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('is_active', true)
        .neq('id', id);

      if (countError) {
        console.error('owner数取得エラー:', countError);
        return NextResponse.json(
          { error: 'owner数の確認に失敗しました', details: countError.message },
          { status: 500 }
        );
      }
      
      if ((ownerCount || 0) === 0) {
        return NextResponse.json(
          { error: '最後のownerを無効化または権限変更することはできません' },
          { status: 400 }
        );
      }
    }

    // 管理者情報を更新
    const { data: updatedAdminUser, error: updateError } = await adminSupabase
      .from('admin_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('管理者更新エラー:', updateError);
      return NextResponse.json(
        { error: '管理者の更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '管理者を更新しました',
      adminUser: updatedAdminUser,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 管理者を削除（物理削除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireOwner(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const adminSupabase = createAdminSupabaseClient();

    // 現在の状態を取得
    const { data: currentAdminUser } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentAdminUser) {
      return NextResponse.json(
        { error: '管理者が見つかりません' },
        { status: 404 }
      );
    }

    // 最後のownerを削除しようとする場合をチェック
    if (currentAdminUser.role === 'owner' && currentAdminUser.is_active) {
      const { count: ownerCount, error: countError } = await adminSupabase
        .from('admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('is_active', true)
        .neq('id', id);

      if (countError) {
        console.error('owner数取得エラー:', countError);
        return NextResponse.json(
          { error: 'owner数の確認に失敗しました', details: countError.message },
          { status: 500 }
        );
      }
      
      if ((ownerCount || 0) === 0) {
        return NextResponse.json(
          { error: '最後のownerを削除することはできません' },
          { status: 400 }
        );
      }
    }

    // 管理者を削除
    const { error: deleteError } = await adminSupabase
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('管理者削除エラー:', deleteError);
      return NextResponse.json(
        { error: '管理者の削除に失敗しました', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '管理者を削除しました',
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
