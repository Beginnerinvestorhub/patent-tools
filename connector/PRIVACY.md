# Privacy Policy: Patent Connector (USPTO)

Last updated: October 4, 2026

## Summary

Patent Connector runs entirely on your own computer. It has no servers, collects no data, and sends nothing to its author.

## What the extension handles

* **Your USPTO API key.** You enter it in Claude Desktop, which saves it in the extension's settings on your computer. How it is protected on disk is up to Claude Desktop, and it may be readable by other software running under your user account. The extension reads the key only to authenticate requests to USPTO, sends it only over HTTPS to uspto.gov addresses, never forwards it when a download is redirected elsewhere, and never includes it in any result shown to Claude. The key is free and you can revoke or regenerate it at any time in My ODP at data.uspto.gov.
* **Your search terms, application numbers and patent numbers.** These come from your conversation with Claude and are sent to USPTO to answer your request. A patent number is sent to USPTO as a search to find its application.
* **Documents from USPTO.** Document text and drawings PDFs are downloaded from USPTO and processed in memory to produce the text or images returned to Claude. Nothing is saved to disk.

## Where data goes

The extension sends requests only to the USPTO Open Data Portal at `api.uspto.gov`. Each request includes your API key and the search terms or application numbers needed to answer it. If USPTO redirects a document download to another storage address, the extension follows it over HTTPS **without** your key; that request contains only the document address USPTO supplied. USPTO's handling of that data is covered by the [USPTO privacy policy](https://www.uspto.gov/privacy-policy) and the ODP terms of use.

Results are passed to Claude as part of your conversation. How Claude handles conversation content is covered by Anthropic's privacy policy.

## What the extension does not do

* It does not run any server or cloud service of its own.
* It does not collect analytics, telemetry or usage data.
* It does not log, store or cache your queries or results to disk.
* It does not share anything with the author or any third party other than USPTO.

## Confidential inventions

Search queries sent to USPTO travel over an encrypted connection, but they do leave your computer. If your invention is unpublished and confidential, describe it in general terms when searching, and talk to your patent attorney about search confidentiality before filing.

## Contact

Questions about this policy can be sent to the author through the project's repository.
