import { useEffect, useState } from "react"

export default function useCities(countryName) {
    const citiesApiUrl = "https://countriesnow.space/api/v0.1/countries/cities";
    const dataToSend = {
        country: countryName
    }
    const [cities , setCities] = useState([]);
    const [isCitiesLoading, setIsCitiesLoading] = useState(false);

    const fetchCitiesList = async () => {
        setIsCitiesLoading(true);
        try{
            const response = await fetch(citiesApiUrl, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dataToSend)
            });
            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            
            const result = await response.json()
            console.log("Success: ", result);
            setCities(result.data);
        }
        catch(err){
            console.log(err.message);
            setCities([]);
        }
        finally{
            setIsCitiesLoading(false)
        }
    }

    useEffect(() => {
        if(countryName === ''){
            setCities([])
            return;
        }
        fetchCitiesList()
    }, [countryName])

  return {cities, isCitiesLoading}
}
