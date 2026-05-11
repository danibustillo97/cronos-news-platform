import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * Get connected TikTok account info
 */
export async function GET(request: NextRequest) {
  try {
    const { data: account, error } = await supabase
      .from('tiktok_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !account) {
      return NextResponse.json(
        { connected: false, account: null },
        { status: 200 }
      );
    }

    // Check token expiration (tokens are valid for 24 hours)
    const createdAt = new Date(account.created_at);
    const expiresIn = account.expires_in || 86400; // Default 24 hours
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000);
    const isExpired = new Date() > expiresAt;

    return NextResponse.json({
      connected: true,
      account: {
        open_id: account.open_id,
        display_name: account.user_info?.display_name || 'TikTok User',
        avatar_url: account.user_info?.avatar_url || null,
        is_expired: isExpired,
        expires_at: expiresAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('TikTok account check error:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check TikTok account' },
      { status: 500 }
    );
  }
}

/**
 * Disconnect TikTok account
 */
export async function DELETE(request: NextRequest) {
  try {
    const { error } = await supabase
      .from('tiktok_accounts')
      .delete()
      .neq('open_id', ''); // Delete all accounts

    if (error) {
      console.error('Disconnect error:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect TikTok account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('TikTok disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect TikTok account' },
      { status: 500 }
    );
  }
}
