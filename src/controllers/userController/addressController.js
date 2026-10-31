function normalizeAddressPayload(payload) {
  const addressLine = String(payload.address || payload.line1 || "").trim();
  return {
    fullName: String(payload.fullName || "").trim(),
    line1: addressLine,
    // Default values for address fields because we are only deliver in ghaziabad rajnagar extention now.
    line2: "Rajnagar extention", //String(payload.line2 || "").trim(),
    city: "Ghaziabad", //String(payload.city || "").trim(),
    state: "Uttar Pradesh", //String(payload.state || "").trim(),
    country: "India", //String(payload.country || "India").trim(),
    postalCode: String(payload.postalCode || "").trim(),
    landmark: String(payload.landmark || "").trim(),
    isDefault: Boolean(payload.isDefault),
  };
}

function validateAddress(address) {
  const requiredFields = ["fullName", "line1"];
  for (const field of requiredFields) {
    if (!address[field]) {
      return `${field === "fullName" ? "Full name" : "Address"} is required`;
    }
  }
  return "";
}

function applyDefaultAddressRule(user, incomingAddressId) {
  let defaultCount = 0;
  for (const address of user.addresses) {
    if (address.isDefault) {
      defaultCount += 1;
    }
  }

  if (defaultCount === 0 && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
    return;
  }

  if (!incomingAddressId) {
    return;
  }

  const updatedAddress = user.addresses.id(incomingAddressId);
  if (!updatedAddress || !updatedAddress.isDefault) {
    return;
  }

  for (const address of user.addresses) {
    if (String(address._id) !== String(incomingAddressId)) {
      address.isDefault = false;
    }
  }
}

async function listAddresses(req, res) {
  return res.status(200).json({ addresses: req.user.addresses || [] });
}

async function addAddress(req, res) {
  const address = normalizeAddressPayload(req.body);
  const validationMessage = validateAddress(address);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  if (req.user.addresses.length === 0) {
    address.isDefault = true;
  }

  req.user.addresses.push(address);
  const newAddress = req.user.addresses[req.user.addresses.length - 1];
  applyDefaultAddressRule(req.user, newAddress._id);
  await req.user.save();

  return res.status(201).json({
    message: "Address added",
    address: newAddress,
  });
}

async function updateAddress(req, res) {
  const addressId = req.params.addressId;
  const existingAddress = req.user.addresses.id(addressId);
  if (!existingAddress) {
    return res.status(404).json({ message: "Address not found" });
  }

  const normalized = normalizeAddressPayload({
    ...existingAddress.toObject(),
    ...req.body,
  });
  const validationMessage = validateAddress(normalized);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  Object.assign(existingAddress, normalized);
  applyDefaultAddressRule(req.user, existingAddress._id);
  await req.user.save();

  return res.status(200).json({
    message: "Address updated",
    address: existingAddress,
  });
}

async function deleteAddress(req, res) {
  const addressId = req.params.addressId;
  const address = req.user.addresses.id(addressId);
  if (!address) {
    return res.status(404).json({ message: "Address not found" });
  }

  address.deleteOne();
  applyDefaultAddressRule(req.user);
  await req.user.save();

  return res.status(200).json({ message: "Address deleted" });
}

module.exports = {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};
