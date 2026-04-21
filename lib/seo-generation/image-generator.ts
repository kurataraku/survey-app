import OpenAI from 'openai';

interface ImageGeneratorInput {
  keyword: string;
  title: string;
  draftType: 'knowledge' | 'school';
  schoolName?: string;
}

interface ImageGeneratorOutput {
  imageUrl: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY が未設定です');
  return new OpenAI({ apiKey });
}

export async function runImageGenerator(
  input: ImageGeneratorInput
): Promise<ImageGeneratorOutput> {
  const client = getOpenAIClient();

  const schoolContext =
    input.draftType === 'school' && input.schoolName
      ? `学校「${input.schoolName}」に関する`
      : '';

  const prompt = `Japanese manga-style editorial illustration for a Japanese education blog header image.

Subject: ${input.title}
${schoolContext ? `Context: An article about ${schoolContext}` : 'Context: Japanese correspondence high schools (通信制高校)'}

STYLE (must follow):
- Clear **Japanese comic / seinen manga** look: clean black ink outlines, cel shading OR soft screentone, readable silhouettes
- ONE simple scene only (e.g. student at desk with textbook, cherry blossom branch outside window, school bag)—easy to understand at a glance
- Warm, hopeful mood for teens and parents; NOT photorealistic, NOT 3D render, NOT Western cartoon, NOT abstract AI-art noise, NOT cluttered collage of random objects
- Background: light flat color or subtle gradient; minimal props so the subject reads clearly

TEXT / GLYPHS (critical — image generators often draw fake writing):
- **Absolutely NO Japanese (kanji/kana), NO Latin letters, NO Arabic numerals, NO symbols that resemble writing**
- **NO pseudo-text, NO gibberish CJK, NO blurry “placeholder” characters** on boards, tags, book spines, screens, calendars, posters, labels, or signs
- Books: **blank spines only** (plain white/gray rectangles, no lines that look like titles)
- Cork boards / memos: **blank sticky notes** and simple geometric doodles only—**no lines of text**
- Phone / laptop screens: **blank white screen** or simple UI bars—no app text
- Backpack / tags / window charms: **solid fabric or plain colored paper**—no logos or lettering
- If a prop would normally show words, **omit the prop** or replace with a **plain shape** (circle, stripe)
- **No small hanging tags, price tickets, corner labels, or decorative rectangles** in image corners—these often become gibberish pseudo-text

COMPOSITION:
- Landscape / wide 16:9 friendly framing; leave empty space on one side for title overlay in design
- NO speech bubbles, NO logos, NO watermarks`;

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024',
    quality: 'hd',
  });

  const generatedUrl = response.data?.[0]?.url;
  if (!generatedUrl) {
    throw new Error('画像生成に失敗しました: URLが空です');
  }

  return { imageUrl: generatedUrl };
}

export async function downloadAndUploadImage(
  generatedUrl: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const imageResponse = await fetch(generatedUrl);
  if (!imageResponse.ok) {
    throw new Error(`画像ダウンロード失敗: ${imageResponse.status}`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const timestamp = Date.now();
  const fileName = `seo-draft-${timestamp}-${Math.random().toString(36).substring(7)}.png`;
  const filePath = `article-images/${fileName}`;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'article-images';

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`画像アップロード失敗: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('公開URLの取得に失敗しました');
  }

  return urlData.publicUrl;
}
