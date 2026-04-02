const normaliseAddressValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/gu, " ")
    .replace(/\s*,\s*/gu, ", ")
    .replace(/,+/gu, ",")
    .trim()
    .replace(/^,\s*/u, "")
    .replace(/,\s*$/u, "");
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const stripLeadingCityFromStreet = (streetValue, cityValue) => {
  let street = normaliseAddressValue(streetValue);
  const city = normaliseAddressValue(cityValue);

  if (!street || !city) {
    return street;
  }

  const cityVariants = [city, `г ${city}`, `г. ${city}`];
  let changed = true;

  while (changed) {
    changed = false;
    for (const variant of cityVariants) {
      const pattern = new RegExp(`^${escapeRegExp(variant)}(?:\\s*,\\s*|\\s+)`, "iu");
      if (!pattern.test(street)) {
        continue;
      }

      street = street.replace(pattern, "").trim().replace(/^,\s*/u, "");
      changed = true;
    }
  }

  return street;
};

export const normalizeDeliveryAddressParts = ({ city, street, house, apartment } = {}) => {
  const normalizedCity = normaliseAddressValue(city);
  const normalizedStreet = stripLeadingCityFromStreet(street, normalizedCity);
  const normalizedHouse = normaliseAddressValue(house);
  const normalizedApartment = normaliseAddressValue(apartment);

  const line1 = [normalizedStreet, normalizedHouse, normalizedApartment].filter(Boolean).join(", ");
  const full = [[normalizedCity, normalizedStreet, normalizedHouse].filter(Boolean).join(", "), normalizedApartment]
    .filter(Boolean)
    .join(", ");

  return {
    city: normalizedCity,
    street: normalizedStreet,
    house: normalizedHouse,
    apartment: normalizedApartment,
    line1,
    full,
  };
};

export const normalizeDeliveryCoordinates = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const latitude = Number(value.lat ?? value.latitude);
  const longitude = Number(value.lon ?? value.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
};
