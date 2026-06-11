import { useEffect, useState } from "react";

function useCountries() {

    const [apiCountriesList, setApiCountriesList] = useState([]);
    const [apiCountriesListLoading, setApiCountriesListLoading] = useState('');

    const fetchCountriesList = async () => {
        setApiCountriesListLoading('loading')
        try{
            const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags')
            const data = await response.json();

            const countryName = data
                .map(country => 
                    ({
                        name: country.name.common, 
                        flag: country.flags.png, 
                        code: country.cca2
                    })
                )
                .sort((a,b) => a.name.localeCompare(b.name));

            setApiCountriesList(countryName)
            localStorage.setItem('apiCountriesListV2', JSON.stringify(countryName))

            console.log(countryName);
        }
        catch(err){
            console.log(err.message);
        }
    }

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('apiCountriesListV2'))

        if(saved && saved.length > 0){
            setApiCountriesList(saved)
        } else{
            fetchCountriesList();
        }
    }, [])

  return {apiCountriesList, apiCountriesListLoading}
}

export default useCountries;
