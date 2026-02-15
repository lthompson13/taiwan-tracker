const { translateText, translateBatch } = require('./translate');

/**
 * Translate all Chinese-value fields on a legislator object.
 */
async function translateLegislator(obj) {
  // Collect all strings to translate in a batch
  const fields = [
    obj.party,
    obj.caucus,
    obj.district,
    obj.gender,
  ];

  // Handle committees array
  const committees = Array.isArray(obj.committees) ? obj.committees : [];
  const committeeStrings = committees.map((c) =>
    typeof c === 'string' ? c : c.name || ''
  );

  // Handle education array
  const education = Array.isArray(obj.education)
    ? obj.education
    : obj.education
      ? [obj.education]
      : [];
  const educationStrings = education.map((e) => (typeof e === 'string' ? e : ''));

  // Handle experience array
  const experience = Array.isArray(obj.experience)
    ? obj.experience
    : obj.experience
      ? [obj.experience]
      : [];
  const experienceStrings = experience.map((e) => (typeof e === 'string' ? e : ''));

  const allTexts = [
    ...fields,
    ...committeeStrings,
    ...educationStrings,
    ...experienceStrings,
  ];

  const translated = await translateBatch(allTexts);

  let idx = 0;
  obj.party = translated[idx++];
  obj.caucus = translated[idx++];
  obj.district = translated[idx++];
  obj.gender = translated[idx++];

  // Rebuild committees
  if (committees.length > 0) {
    obj.committees = committees.map((c, i) => {
      if (typeof c === 'string') return translated[idx + i];
      return { ...c, name: translated[idx + i] };
    });
    idx += committees.length;
  }

  // Rebuild education
  if (education.length > 0) {
    obj.education = education.map((e, i) => {
      if (typeof e === 'string') return translated[idx + i];
      return e;
    });
    idx += education.length;
  }

  // Rebuild experience
  if (experience.length > 0) {
    obj.experience = experience.map((e, i) => {
      if (typeof e === 'string') return translated[idx + i];
      return e;
    });
    idx += experience.length;
  }

  return obj;
}

/**
 * Translate all Chinese-value fields on a bill object.
 */
async function translateBill(obj) {
  const fields = [
    obj.billName,
    obj.status,
    obj.category,
    obj.source,
    obj.proposer,
    obj.meetingDescription,
  ];

  // Handle lawNames
  const lawNames = Array.isArray(obj.lawNames)
    ? obj.lawNames
    : obj.lawNames
      ? [obj.lawNames]
      : [];
  const lawNameStrings = lawNames.map((n) => (typeof n === 'string' ? n : ''));

  // Handle attachments
  const attachments = Array.isArray(obj.attachments) ? obj.attachments : [];
  const attachmentNames = attachments.map((a) => a.name || '');

  const allTexts = [...fields, ...lawNameStrings, ...attachmentNames];
  const translated = await translateBatch(allTexts);

  let idx = 0;
  obj.billName = translated[idx++];
  obj.status = translated[idx++];
  obj.category = translated[idx++];
  obj.source = translated[idx++];
  obj.proposer = translated[idx++];
  obj.meetingDescription = translated[idx++];

  // Rebuild lawNames
  if (lawNames.length > 0) {
    obj.lawNames = lawNames.map((n, i) => {
      if (typeof n === 'string') return translated[idx + i];
      return n;
    });
    idx += lawNames.length;
  }

  // Rebuild attachments
  if (attachments.length > 0) {
    obj.attachments = attachments.map((a, i) => ({
      ...a,
      name: translated[idx + i],
    }));
    idx += attachments.length;
  }

  return obj;
}

/**
 * Translate all Chinese-value fields on a committee object.
 */
async function translateCommittee(obj) {
  const allTexts = [obj.name, obj.responsibilities, obj.category];
  const translated = await translateBatch(allTexts);

  obj.name = translated[0];
  obj.responsibilities = translated[1];
  obj.category = translated[2];

  return obj;
}

/**
 * Translate all Chinese-value fields on an interpellation object.
 */
async function translateInterpellation(obj) {
  const fields = [
    obj.subject,
    obj.description,
    obj.meetingDescription,
  ];

  // Handle legislators array
  const legislators = Array.isArray(obj.legislators) ? obj.legislators : [];
  const legislatorStrings = legislators.map((l) => (typeof l === 'string' ? l : ''));

  const allTexts = [...fields, ...legislatorStrings];
  const translated = await translateBatch(allTexts);

  let idx = 0;
  obj.subject = translated[idx++];
  obj.description = translated[idx++];
  obj.meetingDescription = translated[idx++];

  if (legislators.length > 0) {
    obj.legislators = legislators.map((l, i) => {
      if (typeof l === 'string') return translated[idx + i];
      return l;
    });
    idx += legislators.length;
  }

  return obj;
}

module.exports = {
  translateLegislator,
  translateBill,
  translateCommittee,
  translateInterpellation,
};
