/** Client-safe helpers for phone inputs / Contact Picker / iOS paste. */

export function toNationalLkInput(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string | null = null;

  if (digits.startsWith("94") && digits.length >= 11) {
    national = digits.slice(2, 11);
  } else if (digits.startsWith("0") && digits.length >= 10) {
    national = digits.slice(1, 10);
  } else if (digits.length >= 9) {
    const match = digits.match(/7\d{8}/);
    national = match ? match[0] : digits.slice(-9);
  }

  if (!national || !/^7\d{8}$/.test(national)) {
    return null;
  }
  return national;
}

export function pickBestTel(numbers: string[] | undefined): string | null {
  if (!numbers?.length) return null;
  for (const value of numbers) {
    const national = toNationalLkInput(value);
    if (national) return national;
  }
  const digits = numbers[0]?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("94") && digits.length > 2) return digits.slice(2);
  if (digits.startsWith("0") && digits.length > 1) return digits.slice(1);
  return digits || null;
}

type ContactInfo = {
  name?: string[];
  tel?: string[];
};

type ContactsManager = {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<ContactInfo[]>;
};

export function getContactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const contacts = (
    navigator as Navigator & { contacts?: ContactsManager }
  ).contacts;
  return contacts && typeof contacts.select === "function" ? contacts : null;
}

export function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS;
}

export function canUseSystemContactPicker() {
  return Boolean(getContactsManager());
}

export async function pickContactFromPhonebook(): Promise<{
  phone: string;
  name: string | null;
} | null> {
  const contacts = getContactsManager();
  if (!contacts) {
    throw new Error("CONTACT_PICKER_UNSUPPORTED");
  }

  const selected = await contacts.select(["tel", "name"], { multiple: false });
  const contact = selected[0];
  if (!contact) return null;

  const phone = pickBestTel(contact.tel);
  if (!phone) {
    throw new Error("That contact has no usable phone number");
  }

  return {
    phone,
    name: contact.name?.[0]?.trim() || null,
  };
}

export async function pickPhoneFromClipboard(): Promise<string> {
  if (!navigator.clipboard?.readText) {
    throw new Error(
      "Paste is not available. Long-press the phone field and choose Paste.",
    );
  }

  const text = await navigator.clipboard.readText();
  const phone = toNationalLkInput(text);
  if (!phone) {
    throw new Error(
      "No Sri Lankan mobile number found on the clipboard. In Contacts, copy the number, then tap Paste again.",
    );
  }
  return phone;
}

/** Parse a shared .vcf / vCard file (works when iOS shares a contact). */
export async function pickPhoneFromVCardFile(file: File): Promise<{
  phone: string;
  name: string | null;
}> {
  const text = await file.text();
  const tels = [...text.matchAll(/^TEL[^:]*:(.+)$/gim)].map((m) =>
    m[1].trim(),
  );
  const phone = pickBestTel(tels);
  if (!phone) {
    throw new Error("That contact card has no usable mobile number");
  }

  const fn = text.match(/^FN:(.+)$/im)?.[1]?.trim() ?? null;
  return { phone, name: fn };
}
