import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorBanner from './ErrorBanner.vue'

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Failed to load data' } })
    expect(wrapper.text()).toContain('Failed to load data')
  })

  it('has role="alert" for screen readers', () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Error' } })
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it('emits retry when retry button is clicked', async () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Error' } })
    await wrapper.find('[data-testid="retry-btn"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
