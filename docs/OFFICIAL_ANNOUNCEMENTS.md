# Official announcements

When you post important updates (new features, maintenance, policy changes), you usually want the message to appear as coming from **Board Official** (or "Official account of Board") rather than from your personal username.

## Recommended way: use a bot

1. Go to **Settings → Developer Portal → New App**.
2. Name the app **Board Official** (or "Board" / "Official Board").
3. Copy the bot token (shown only once).
4. Install the bot into the servers/channels where you want to post announcements.
5. Give it permission to send messages in the announcement channel(s).

Post from the bot (via the bot API, a simple script, or a library pointed at your instance).  
Messages from the bot appear under the bot's name and are clearly marked as app/bot content. They are **not** end-to-end encrypted (which is appropriate for public announcements).

This completely hides who the human operator is.

## Alternative: system / webhook style

You can also use a webhook with the name and avatar set to "Board Official". Webhook messages appear under that name.

## Future improvement

A built-in "Official" or "System" sender that the instance owner can use (and that always displays as Board Official) is a good candidate for a later feature. For now the bot approach works immediately and matches how most chat platforms handle official posts.
