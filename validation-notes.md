# No-login workspace validation

The public preview opens directly to the AI Chat Studio workspace without a sign-in screen. A new local conversation can be created from the conversation rail, and the Settings tab exposes the custom OpenAI-compatible configuration fields and clearly describes the temporary API-key handling model.

The project editor was updated with new HTML during a browser session. The sandboxed preview changed immediately to display the edited content, confirming that local code edits update the live preview without authentication.

The desktop/mobile preview control was exercised, and the mobile frame rendered successfully. After a full browser reload, the newly created local conversation and edited HTML file were still present. The fresh browser console contained no output or errors. A live provider connection was not invoked because no user API key was entered during validation.

Following the transient server-session update, the public workspace still opened directly with no sign-in gate. A true 390px mobile viewport was captured and showed the workspace’s stacked layout, editor, and sandboxed preview. The latest browser-console review again contained no output or errors.
