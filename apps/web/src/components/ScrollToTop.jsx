import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Resets the app to the top on every route change. The app scrolls an INNER
// container (#app-scroll-container in App.jsx) locked to the viewport height —
// NOT the window — so window.scrollTo would be a no-op. We must scroll that
// element. Keyed on pathname only: query-string changes don't force a jump, but
// path changes (incl. profile tab switches like /profilemain -> /about, whose
// content sits below a tall banner) do reset to the top. Renders nothing.
export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        document.getElementById('app-scroll-container')?.scrollTo({ top: 0 });
    }, [pathname]);

    return null;
}
