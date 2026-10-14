# USPTO API key for other hosts

Claude Code and the Claude Desktop extension ask for your USPTO API key
themselves and keep it in secure storage, so you do not need anything on
this page for them. See the
[connector README](../connector/README.md#set-your-uspto-api-key).

This page is for hosts that start the Patent Connector from
`mcp_config.json` (Devin) or from an MCP config you write yourself. Those
hosts pass the key to the server through the `USPTO_ODP_API_KEY`
environment variable of the app or terminal that starts them. This page is
kept on the `main` branch only and is not part of the installed Claude Code
plugin.

Get the key first: sign in at [data.uspto.gov](https://data.uspto.gov),
open **My ODP**, and copy it. Treat the key like a password: do not paste
it into chats, issues or screenshots. If it ever leaks, regenerate it in My
ODP.

## Prefer the host's own secret settings

If your host has a settings screen or a secrets store for MCP servers, put
the key there and map it to `USPTO_ODP_API_KEY`. That keeps it out of your
shell profile and away from every other program you run. Use the steps
below only when the host has no such option.

## Windows

1. Open Command Prompt or PowerShell and run (with your own key inside the
   quotes):

   ```
   setx USPTO_ODP_API_KEY "your_key_here"
   ```

   Or use the dialog: press Start, type "environment variables", open
   **Edit the system environment variables**, click **Environment
   Variables**, and under **User variables** click **New** with the name
   `USPTO_ODP_API_KEY` and your key as the value.
2. `setx` only affects programs started afterwards. Close every terminal
   and quit the app completely (including from the system tray), then open
   it again.

## macOS and Linux

1. Add this line to your shell profile: `~/.zshrc` for zsh (the macOS
   default) or `~/.bashrc` for bash.

   ```
   export USPTO_ODP_API_KEY="your_key_here"
   ```

2. Open a new terminal (or run `source ~/.zshrc`), then start the host from
   that terminal. Apps started from the Dock or a launcher may not read your
   shell profile; start them from a terminal if the key is not found.

## Check that it is set

* Windows Command Prompt: `echo %USPTO_ODP_API_KEY%`
* PowerShell: `echo $env:USPTO_ODP_API_KEY`
* macOS and Linux: `echo $USPTO_ODP_API_KEY`

It should print something other than an empty line (or, on Windows, the
literal `%USPTO_ODP_API_KEY%`).

## Local development

To run the live tests in this repository, copy `.env.example` (at the
repository root) to `.env`, put your key in it, and pass it to Node with
`--env-file`, for example `node --env-file=../.env test/smoke.mjs` from
`connector/`. `.env` is ignored by git. The plugin and the extension do not
read `.env`.
