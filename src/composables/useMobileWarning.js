import { ref, onMounted, onUnmounted } from 'vue'

const storageKey = 'soilSight_mobile_warning_dismissed'

export default function useMobileWarning() {
    const show = ref(false)
    let mql = null

    const isSmall = () => {
        if (typeof window === 'undefined') return false
        try {
            return window.matchMedia('(max-width: 900px)').matches
        } catch {
            return false
        }
    }

    function update() {
        try {
            const dismissed = typeof localStorage !== 'undefined' && localStorage.getItem(storageKey)
            show.value = isSmall() && !dismissed
        } catch {
            show.value = isSmall()
        }
    }

    onMounted(() => {
        update()
        try {
            mql = window.matchMedia('(max-width: 900px)')
            if (mql && typeof mql.addEventListener === 'function') mql.addEventListener('change', update)
            else if (mql && typeof mql.addListener === 'function') mql.addListener(update)
        } catch {
            // ignore
        }
    })

    onUnmounted(() => {
        try {
            if (mql && typeof mql.removeEventListener === 'function') mql.removeEventListener('change', update)
            else if (mql && typeof mql.removeListener === 'function') mql.removeListener(update)
        } catch {
            // ignore
        }
    })

    return { show, storageKey }
}
