import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * TikTok Video Upload
 * Initiates direct video upload to TikTok
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const privacyLevel = formData.get('privacy_level') as string || 'PUBLIC';
    const disableDuet = formData.get('disable_duet') === 'true';
    const disableStitch = formData.get('disable_stitch') === 'true';
    const disableComment = formData.get('disable_comment') === 'false'; // default true

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    // Get stored TikTok credentials
    const { data: account, error: accountError } = await supabase
      .from('tiktok_accounts')
      .select('*')
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
    let accessToken = account.access_token;
    
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
          video_size: videoFile.size,
          chunk_size: videoFile.size, // Single chunk for now
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

    // Step 2: Upload video file
    const videoBuffer = await videoFile.arrayBuffer();
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoFile.size - 1}/${videoFile.size}`,
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('TikTok video upload error:', await uploadResponse.text());
      return NextResponse.json(
        { error: 'Failed to upload video to TikTok' },
        { status: 500 }
      );
    }

    // Step 3: Check publish status
    const statusResponse = await fetch(`https://open.tiktokapis.com/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    let publishStatus = null;
    if (statusResponse.ok) {
      publishStatus = await statusResponse.json();
    }

    return NextResponse.json({
      success: true,
      publish_id: publishId,
      status: publishStatus?.data?.status || 'PENDING',
      share_url: publishStatus?.data?.share_url || null,
    });

  } catch (error) {
    console.error('TikTok upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to TikTok' },
      { status: 500 }
    );
  }
}
