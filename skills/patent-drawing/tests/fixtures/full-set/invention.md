# Invention disclosure: Shared pantry tracker

A system that helps households avoid buying duplicate groceries.

Components:
- A mobile app on each household member's phone.
- A cloud server running an inventory service and a notification service.
- A database storing pantry items (name, quantity, expiry date).
- A barcode scanner built into the mobile app.

Method (claim 1, draft):
1. receiving, from a mobile device, a scanned barcode of a grocery item;
2. looking up the item in a product database;
3. updating a shared pantry inventory for the household;
4. determining whether the item quantity is below a restock threshold;
5. when below the threshold, adding the item to a shared shopping list;
6. determining whether any item expires within three days;
7. when an item expires within three days, sending an expiry alert to every household member;
8. synchronizing the updated inventory and shopping list to every household member's mobile device.

User interface: the app's home screen shows a "Scan item" button, the shared
shopping list, and an "Expiring soon" panel.

Docket number: PT-2026-01
