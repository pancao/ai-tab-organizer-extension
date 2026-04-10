const ORGANIZABLE_PROTOCOLS = new Set(["http:", "https:"]);

function getTabUrl(tab) {
  return String(tab?.url || tab?.pendingUrl || "").trim();
}

function isOrganizableTab(tab) {
  if (!tab?.id || tab?.pinned) {
    return false;
  }

  const url = getTabUrl(tab);

  if (!url) {
    return false;
  }

  try {
    return ORGANIZABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch (_error) {
    return false;
  }
}

export function getCandidateTabs(tabs) {
  return (Array.isArray(tabs) ? tabs : []).filter(isOrganizableTab);
}

export function isOrganizableProtocol(url) {
  const value = String(url || "").trim();

  if (!value) {
    return false;
  }

  try {
    return ORGANIZABLE_PROTOCOLS.has(new URL(value).protocol);
  } catch (_error) {
    return false;
  }
}
