import {createRoot} from 'react-dom/client'
import{BrowserRouter} from 'react-router-dom' 
import App from './App'
import './index.css'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

createRoot(
  document.getElementById('root')
).render(
  <BrowserRouter>
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <App/>
  </LocalizationProvider>
  </BrowserRouter>
)