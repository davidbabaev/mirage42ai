import countries from "../data/countries";

// Countries are now bundled as static data (apps/web/src/data/countries.js)
// instead of fetched from restcountries.com, which CORS-blocks our production
// origin. The list is tiny (~2 KB gzipped) so it ships in the main bundle.
// Shape and field names are unchanged ({ name, code }) so callers are untouched;
// apiCountriesListLoading stays for API compatibility but is always falsy now.
function useCountries() {
    return { apiCountriesList: countries, apiCountriesListLoading: '' };
}

export default useCountries;
