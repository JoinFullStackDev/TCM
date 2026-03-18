import { NextResponse } from 'next/server';
import { withAuth, notFound, serverError } from '@/lib/api/helpers';

interface RouteContext {
  params: Promise<{ noteId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await withAuth('write');
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;
  const { noteId } = await context.params;

  const { data: note } = await supabase
    .from('notes')
    .select('id, author_id, content_plain, content')
    .eq('id', noteId)
    .single();

  if (!note) return notFound('Note');
  if (note.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const textContent = note.content_plain || note.content;
  if (!textContent || textContent.trim().length < 20) {
    return NextResponse.json(
      { error: 'Note content is too short to summarize' },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return serverError('AI summarization is not configured');
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1024,
        system: 'You are a concise summarizer for meeting notes and technical documentation. Produce a clear, structured summary with key points, action items, and decisions. Use bullet points. Keep it under 300 words.',
        messages: [
          {
            role: 'user',
            content: `Summarize the following notes:\n\n${textContent.slice(0, 8000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return serverError('AI summarization failed');
    }

    const result = await response.json();
    const summary = result.content?.[0]?.text ?? '';

    const { error: updateError } = await supabase
      .from('notes')
      .update({ summary })
      .eq('id', noteId);

    if (updateError) return serverError(updateError.message);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Summarization error:', err);
    return serverError('AI summarization failed');
  }
}
