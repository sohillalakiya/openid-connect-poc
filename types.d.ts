import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'platform-waffle': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { token?: string; theme?: 'light' | 'dark' | 'auto' }
    }
  }
}
