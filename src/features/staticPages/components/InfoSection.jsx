import FadeInView from '@/components/motion/FadeInView'
import Section from '@/components/layout/Section'

// One section of an information page: the shared `Section` (heading, eyebrow,
// description, `aria-labelledby`) with an anchor id and an in-view reveal.
//
// The id is what the table of contents links to; `InfoPageLayout` gives every
// `<section id>` inside it the scroll offset that clears the sticky top nav.
// Spacing between sections comes from the layout's `Stack`, so `Section`'s own
// bottom margin is deliberately left unused here.

/**
 * @param {object} props
 * @param {string} props.id anchor id — must match the page's `toc` entry
 * @param {React.ReactNode} props.title section heading (rendered as `h2`)
 * @param {React.ReactNode} [props.eyebrow] small uppercase label above the heading
 * @param {React.ReactNode} [props.description] supporting copy under the heading
 * @param {number} [props.delay=0] seconds to delay the reveal
 * @param {React.ReactNode} props.children section content
 */
export default function InfoSection({ id, title, eyebrow, description, delay = 0, children, ...rest }) {
  return (
    <FadeInView delay={delay}>
      <Section id={id} title={title} eyebrow={eyebrow} description={description} {...rest}>
        {children}
      </Section>
    </FadeInView>
  )
}
