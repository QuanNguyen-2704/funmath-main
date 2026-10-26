# Enable Power Grid online rooms

Power Grid uses the existing `math-bdf5e` Firebase Realtime Database, with the same public web configuration and SDK version as `Carronade_Multiplayer.html`. It stores its rooms at:

```text
rooms/power-grid-ABC234
```

Local play needs no Firebase access. Online play requires **read and write access at the individual room path**; Firebase transactions require both. A read-only request to an unused Power Grid room returned `Permission denied` during development. No production database rules or existing room data were changed.

## Update access in Firebase Console

1. Open project **math-bdf5e**, then **Build → Realtime Database → Rules**.
2. Save a copy of the current rules before editing them.
3. Add access for Power Grid room keys inside the existing `rooms` rules. Preserve access rules for Carronade, Symmetry, and every other existing path.

For a `rooms/$roomId` rule, the Power Grid conditions are:

```text
Read condition:
$roomId.matches(/^power-grid-[A-HJ-NP-Z2-9]{6}$/)

Write condition:
$roomId.matches(/^power-grid-[A-HJ-NP-Z2-9]{6}$/) && newData.child('type').val() == 'power-grid' && newData.child('version').val() == 1
```

If there is already a wildcard under `rooms`, use its existing variable name. Combine each existing expression with the corresponding condition using `(<existing condition>) || (<Power Grid condition>)`; do not replace working rules or add a second wildcard at the same level. If no `rooms` wildcard exists, the following is the **room subtree** to merge into the existing rules, not a replacement for the full database rules:

```json
{
  "$roomId": {
    ".read": "$roomId.matches(/^power-grid-[A-HJ-NP-Z2-9]{6}$/)",
    ".write": "$roomId.matches(/^power-grid-[A-HJ-NP-Z2-9]{6}$/) && newData.child('type').val() == 'power-grid' && newData.child('version').val() == 1"
  }
}
```

Existing `.validate` rules can impose additional constraints; check them against the new room structure. App Check enforcement, if enabled, also needs to support this web client. The repository cannot inspect or publish the project's private console settings.

This matches the existing trusted, code-sharing classroom setup: no login, no personal details, and public access to rooms whose code is known. The seat token prevents accidental role switching in the UI; it is not authenticated authorization. The client checks turns and valid moves, but these rules do not provide server-enforced anti-cheat.

## Verify after publishing the access change

1. Run the site through Live Server, `python -m http.server 8000`, or GitHub Pages.
2. Open **Power Grid Online**, choose the dimensions, and create a room.
3. On a second device or separate browser session, enter the displayed code. A localhost invite URL only works on the hosting computer; use the deployed site URL for remote students.
4. Confirm the first player cannot move before the second joins, and each player can move only on their turn.
5. Shade a rectangle, check that both boards update, and try an overlapping or non-power-of-two area.
6. Finish the board: the player who shaded the last square must lose. Both players request a rematch; the starting player should alternate.
7. Refresh the same tab and rejoin to recover that seat. Try a third browser session: the room should report that both seats are taken.

## References

- [Firebase transactions and read/write operations](https://firebase.google.com/docs/database/web/read-and-write)
- [Connection state and disconnect hooks](https://firebase.google.com/docs/database/web/offline-capabilities)
- [Security rules string matching](https://firebase.google.com/docs/reference/security/database#stringmatches)
