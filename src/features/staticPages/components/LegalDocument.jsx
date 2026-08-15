import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import InfoSection from './InfoSection'
import ProseList from './ProseList'

// Renders a numbered legal document (Terms, Privacy) from a plain content
// array, so both pages share one structure and the copy stays in
// `../content/*.js` rather than in a wall of JSX.
//
// Section numbering is derived from array order — reordering the content
// module renumbers the document and its table of contents together.

/**
 * @typedef {object} LegalSection
 * @property {string} id anchor id
 * @property {string} title section heading, without its number
 * @property {string[]} [paragraphs] body copy
 * @property {string[]} [list] bulleted points under the paragraphs
 * @property {string} [closing] a final paragraph after the list
 */

/**
 * @param {object} props
 * @param {LegalSection[]} props.sections the document, in order
 */
export default function LegalDocument({ sections = [] }) {
  return sections.map((section, index) => (
    <InfoSection key={section.id} id={section.id} title={`${index + 1}. ${section.title}`}>
      <Stack spacing={2}>
        {section.paragraphs?.map((paragraph) => (
          <Typography key={paragraph} variant="body1" color="text.secondary">
            {paragraph}
          </Typography>
        ))}

        {section.list ? <ProseList items={section.list} /> : null}

        {section.closing ? (
          <Typography variant="body1" color="text.secondary">
            {section.closing}
          </Typography>
        ) : null}
      </Stack>
    </InfoSection>
  ))
}
