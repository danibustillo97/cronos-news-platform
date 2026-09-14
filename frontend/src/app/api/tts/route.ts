import { NextRequest, NextResponse } from 'next/server';
import { Communicate, listVoices } from 'edge-tts-universal';

const normalizeSignedParam = (
  raw: string | null,
  fallback: string,
  unit: '%' | 'Hz'
) => {
  if (!raw) return fallback;

  let v = raw.trim().replace(/\s+/g, '');

  const signed = unit === '%' ? /^[+-]\d+%$/ : /^[+-]\d+Hz$/;
  const unsigned = unit === '%' ? /^\d+%$/ : /^\d+Hz$/;

  if (unsigned.test(v)) v = `+${v}`;

  if (!signed.test(v)) return fallback;

  return v;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');
  const voice = searchParams.get('voice') || 'es-MX-DaliaNeural';
  const rate = normalizeSignedParam(searchParams.get('rate'), '-10%', '%');
  const pitch = normalizeSignedParam(searchParams.get('pitch'), '+0Hz', 'Hz');

  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  try {
    const communicate = new Communicate(text, { 
        voice, 
        rate, 
        pitch 
    });

    const audioChunks: Buffer[] = [];

    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        audioChunks.push(chunk.data);
      }
    }

    const audioBuffer = Buffer.concat(audioChunks);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    // List voices endpoint
    try {
        const voices = await listVoices();
        // Filter for Spanish voices
        const spanishVoices = voices.filter(v => v.ShortName.startsWith('es-'));
        return NextResponse.json(spanishVoices);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to list voices' }, { status: 500 });
    }
}
