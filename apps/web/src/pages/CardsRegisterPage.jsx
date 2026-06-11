import { useNavigate } from 'react-router-dom';
import CreateCardForm from '../components/CreateCardForm';

export default function CardsRegisterPage() {

    const navigate = useNavigate();

  return (
    <div style={{padding: '5px', border: '1px solid lightGray', borderRadius:'10px'}}>
        <CreateCardForm
            onSuccess = {() => navigate('/dashboard/mycards')}
        />    
    </div>
    )
}
