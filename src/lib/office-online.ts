// An office is "online" in OASYS once someone can act on its appointments: it has an approved
// office admin account, or it is a sub-office whose main office has one (main-office admins
// handle their sub-offices' appointments). Offline offices are listed but can't be booked.

export const OFFICE_OFFLINE_LABEL = "Offline";
export const OFFICE_OFFLINE_MESSAGE = "This office is still offline and does not support appointments in OASYS yet. Please contact the office directly.";
