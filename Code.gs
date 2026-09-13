function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Basic validation
    if (!data.email || !data.name) {
      return jsonResponse({ status: "error", message: "Missing name or email." });
    }

    const pdfBlob = createBookingPdf(data);
    sendConfirmationEmail(data, pdfBlob);

    return jsonResponse({ status: "success" });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.message });
  }
}

// Lets you sanity-check the deployment by opening the Web App URL directly
function doGet(e) {
  return ContentService
    .createTextOutput("Meadow Day Picnic booking endpoint is running. Use POST to submit a booking.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Builds a Google Doc from the booking data and returns it as a PDF blob.
 */
function createBookingPdf(data) {
  const docName = `Picnic Booking - ${data.name} - ${data.date}`;
  const doc = DocumentApp.create(docName);
  const body = doc.getBody();

  body.appendParagraph("Meadow Day Picnic Co.").setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Booking Confirmation").setHeading(DocumentApp.ParagraphHeading.HEADING1);

  body.appendParagraph(" ");
  body.appendParagraph(`Name: ${data.name}`);
  body.appendParagraph(`Email: ${data.email}`);
  body.appendParagraph(`Picnic city: ${data.city}`);
  body.appendParagraph(`Date: ${data.date}`);
  body.appendParagraph(`Guests: ${data.guests}`);
  body.appendParagraph(`Spot type: ${data.spot}`);

  body.appendParagraph(" ");
  body.appendParagraph("Weather at time of booking").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(data.weatherSummary || "Not checked");

  body.appendParagraph(" ");
  body.appendParagraph("Thanks for booking with Meadow Day Picnic Co. See you on the grass!");

  doc.saveAndClose();

  // Export the Doc as a PDF blob
  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(`${docName}.pdf`);

  // Remove the intermediate Google Doc from Drive — we only need the PDF
  docFile.setTrashed(true);

  return pdfBlob;
}

/**
 * Emails the generated PDF to the customer.
 */
function sendConfirmationEmail(data, pdfBlob) {
  MailApp.sendEmail({
    to: data.email,
    subject: `Your picnic booking is confirmed — ${data.date}`,
    body:
      `Hi ${data.name},\n\n` +
      `Your picnic spot (${data.spot}) in ${data.city} on ${data.date} is booked for ${data.guests} guest(s).\n` +
      `Your confirmation is attached as a PDF.\n\n` +
      `See you there!\nMeadow Day Picnic Co.`,
    attachments: [pdfBlob]
  });
}

/**
 * Helper to always return JSON with the right content type.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
