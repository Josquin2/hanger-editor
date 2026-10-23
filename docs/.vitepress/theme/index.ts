import type { App } from 'vue'
import DefaultTheme from 'vitepress/theme'
import Playground from './components/Playground.vue'
import 'hanger-editor/rich-textarea.css'
import './styles/custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component('Playground', Playground)
  },
}
