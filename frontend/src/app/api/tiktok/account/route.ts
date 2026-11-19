import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { adminAuthError, requireAdmin } from '@/lib/supabaseAuth';

/**
 * Get connected TikTok account info
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const supabase = createSupabaseServerClient();
    
    const { data: account, error } = await supabase
      .from('tiktok_accounts')
      .select('open_id,user_info,expires_in,created_at')
      .eq('user_id', admin.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.log('[TikTok Account] Error:', error);
      return NextResponse.json(
        { connected: false, account: null, error: error.message },
        { status: 200 }
      );
    }

    if (!account) {
      console.log('[TikTok Account] No account found');
      return NextResponse.json(
        { connected: false, account: null },
        { status: 200 }
      );
    }
    
    console.log('[TikTok Account] Found account:', account.open_id);

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
    if (error instanceof Error && 'status' in error) {
      return adminAuthError(error);
    }
    console.error('TikTok account check could not be completed');
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
    const admin = await requireAdmin(request);
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from('tiktok_accounts')
      .delete()
      .eq('user_id', admin.id)

    if (error) {
      if (error instanceof Error && 'status' in error) {
        return adminAuthError(error);
      }
      console.error('TikTok account disconnect could not be completed');
      return NextResponse.json(
        { error: 'Failed to disconnect TikTok account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      return adminAuthError(error);
    }
    console.error('TikTok disconnect could not be completed');
    return NextResponse.json(
      { error: 'Failed to disconnect TikTok account' },
      { status: 500 }
    );
  }
}
