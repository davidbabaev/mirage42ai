import { useEffect, useState } from "react"

// Cities are bundled (src/data/cities.json, ~31 KB gzipped) and lazy-loaded via
// dynamic import() so the data stays OFF the initial bundle — its chunk is only
// fetched when a component using this hook first mounts. Replaces the
// countriesnow.space POST call that CORS-blocked our production origin. The map
// is keyed by country NAME, matching the value stored from the Country dropdown.
let citiesPromise;
const loadCities = () => {
    if (!citiesPromise) citiesPromise = import("../data/cities.json").then(m => m.default);
    return citiesPromise;
};

export default function useCities(countryName) {
    const [cities, setCities] = useState([]);
    const [isCitiesLoading, setIsCitiesLoading] = useState(false);

    useEffect(() => {
        if (!countryName) {
            setCities([]);
            return;
        }
        let active = true;
        setIsCitiesLoading(true);
        loadCities()
            .then(data => { if (active) setCities(data[countryName] || []); })
            .catch(() => { if (active) setCities([]); })
            .finally(() => { if (active) setIsCitiesLoading(false); });
        return () => { active = false; };
    }, [countryName]);

    return { cities, isCitiesLoading };
}
