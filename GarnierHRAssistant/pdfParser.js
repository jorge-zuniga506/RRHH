const { PDFParse } = require('pdf-parse');

/**
 * Parses a PDF buffer and extracts text page-by-page
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Array<{pageNumber: number, text: string}>>} Pages array
 */
async function parsePDF(buffer) {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.pages.map(page => ({
      pageNumber: page.num,
      text: page.text
    }));
  } catch (error) {
    console.error('Error parsing PDF:', error.message);
    throw error;
  }
}

module.exports = {
  parsePDF
};
