import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { adminAuthError, requireAdmin } from '@/lib/supabaseAuth';
import { decryptToken } from '@/lib/tokenEncryption';

/**
 * TikTok Video Upload
 * Initiates direct video upload to TikTok
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const supabase = createSupabaseServerClient();
    const body = await request.json().catch(() => null) as {
      videoSize?: unknown
      title?: unknown
      privacy_level?: unknown
      disable_duet?: unknown
      disable_stitch?: unknown
      disable_comment?: unknown
    } | null;
    const videoSize = typeof body?.videoSize === 'number' ? body.videoSize : 0;
    const title = typeof body?.title === 'string' ? body.title.slice(0, 150) : '';
    const privacyLevel = typeof body?.privacy_level === 'string' ? body.privacy_level : 'PUBLIC';
    const disableDuet = body?.disable_duet === true;
    const disableStitch = body?.disable_stitch === true;
    const disableComment = body?.disable_comment !== false;

    if (!Number.isSafeInteger(videoSize) || videoSize <= 0) {
      return NextResponse.json({ error: 'Valid videoSize is required' }, { status: 400 });
    }
    if (videoSize > 500 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video exceeds 500 MB limit' }, { status: 413 });
    }

    // Get stored TikTok credentials
    const { data: account, error: accountError } = await supabase
      .from('tiktok_accounts')
      .select('open_id,access_token_encrypted,refresh_token_encrypted,expires_in,created_at')
      .eq('user_id', admin.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'No TikTok account connected' },
        { status: 401 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = decryptToken(account.access_token_encrypted);
    
    // Step 1: Initiate video upload
    const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
        title: title,
        privacy_level: privacyLevel,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
        disable_comment: disableComment,
      }),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      console.error('TikTok upload init error:', errorData);
      return NextResponse.json(
        { error: 'Failed to initiate TikTok upload' },
        { status: 500 }
      );
    }

    const initData = await initResponse.json();
    
    if (!initData.data?.publish_id) {
      return NextResponse.json(
        { error: 'Invalid response from TikTok' },
        { status: 500 }
      );
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // The browser uploads directly to TikTok's upload_url. This route
    // deliberately never receives the video bytes.

    return NextResponse.json({
      success: true,
      publish_id: publishId,
      upload_url: uploadUrl,
      status: 'PENDING',
    });

  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return adminAuthError(error);
    }
    console.error('TikTok upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to TikTok' },
      { status: 500 }
    );
  }
}
