import React from 'react';
import slackLogo from '@/assets/slack-logo.png';

/**
 * Sidebar header component
 * Displays app branding and logo
 */
export function SidebarHeader() {
  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-3">
        <img src={slackLogo} alt="Slack" className="h-8 w-8" />
        <h2 className="text-lg font-semibold">Slack Knowledge Agent</h2>
      </div>
    </div>
  );
}
