import styles from './dashboard.module.css';
import React, {useEffect, useState} from 'react';
import { fetchJson } from '../lib/api';

const formatPrice = (value) => {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
        return value ?? '—';
    }
    return `USh ${numberValue.toLocaleString()}`;
};

function Dashboard() {

        const [editPrceIsVisible, setEditPriceIsVisible] = useState(false)
        const [isVisible, setIsVisible] = useState(false)
        const [formData, setFormData] = useState({
            siteName: '',
            agentName: '',
            lat: '',
            lng: ''
        })
        const [cropName, setCropName] = useState('')
        const [cropPrice, setCropPrice] = useState('')
        const [mName, setMname] = useState('')
        const [priceRecords, setPriceRecords] = useState([])
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState('')

        useEffect(() => {
            let isMounted = true;

            const loadRecords = async () => {
                try {
                    setLoading(true)
                    setError('')
                    const data = await fetchJson('/prices/search/')
                    if (isMounted) {
                        setPriceRecords(Array.isArray(data) ? data : [])
                    }
                } catch (requestError) {
                    if (isMounted) {
                        setError(requestError.message || 'Unable to load agent prices.')
                        setPriceRecords([])
                    }
                } finally {
                    if (isMounted) {
                        setLoading(false)
                    }
                }
            }

            loadRecords()

            return () => {
                isMounted = false
            }
        }, [])

        const MarketName = priceRecords[0]?.market?.name || 'Market Agent Dashboard'

        function updateML(){
           
            setIsVisible(true);
            setMname(MarketName)
        }
        const getLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        // Update your form state here
                        setFormData({ ...formData, lat: latitude, lng: longitude });
                        alert("Location captured!");
                    },
                    (error) => {
                        console.error("Error getting location:", error);
                        alert("Please enable location permissions in your browser.");
                    }
                );
            } 
            else {
                alert("Geolocation is not supported by this browser.");
            }
        }; 

        const currentPrices = priceRecords.map((record) => ({
            id: record.id,
            name: record.crop?.name || 'Unknown crop',
            price: formatPrice(record.retail_price ?? record.wholesale_price),
            market: record.market?.name || MarketName,
        }))

        const dislist = currentPrices.map((list) => (
            <li key={list.id}>
                        <a onClick={()=>UpdatePrice(list.name, list.price)}>
                            {list.name}: &nbsp;
                        <b>{list.price}</b>
                        </a>
                   </li>
        ))

        function UpdatePrice (name,price) {
            setEditPriceIsVisible(true);
            setCropName(name);
            setCropPrice(price)
        }

        function handlePriceChange(event){
            setCropPrice(event.target.value);
        }

       function handleNameChange(event){
            setCropName(event.target.value);
        } 

       function handleMaketN(event){
        setMname(event.target.value)
       }
 
    return(
        <>
            <div className={styles.dash}>
              <div className={styles.head}>
                <h1>Welcome Market Agent</h1>
               <p>My Market [{MarketName}]</p> 
               <button onClick={()=>updateML()} className={styles.locbtn} >
                Update Location
               </button >
              </div>

               <div className={styles.pdash}>

                    <div className={styles.addcrop}>
                        <h3>Add New Crops</h3>
                        <form action="">
                            <label htmlFor="name">Crop Name</label>
                            <input name='name'  type="text" required/>

                            <label htmlFor="cprice">Crop Price</label>
                            <input type="number" id='price' name='cprice' step="0.01" min="0" placeholder='0.00' required />

                            <label htmlFor="unit">Unit</label>
                            <input type="text" id='unit' placeholder='e.g kg' name='unit' />

                            <button>Add</button>
                        </form>
                    </div>
                    <div className={styles.plist}>
                        <h3>Current Prices</h3>
                        <ul>
                            {loading && <li>Loading current prices...</li>}
                            {!loading && error && <li>{error}</li>}
                            {!loading && !error && dislist}
                        </ul>
                    </div>
               </div>

              { isVisible && <div className={styles.update}>
                    <div className={ styles.loction}>
                        <form action="">
                            <label htmlFor="name">Market Name</label>
                            <input onChange={handleMaketN} type="text" value={mName} name='name' required/>

                            <label>Site Location</label>
                                <button type="button" onClick={getLocation} className="locbtn">
                                    📍 Use My Current Location
                                </button>

                               { /*<input 
                                    type="text" 
                                    placeholder="Latitude" 
                                    value={formData.lat} 
                                    readOnly 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Longitude" 
                                    value={formData.lng} 
                                    readOnly 
                                />*/}

                                
                        </form>
                         <div className={styles.btn}>
                            <button>SUBMIT</button>
                            <button onClick={()=> setIsVisible(false)}>Cancel</button>
                         </div>
                    </div>

                    
               </div> }
              
                { editPrceIsVisible && <div className={styles.update}> <div className={styles.pupdate} >
                            <form action="">
                                <label htmlFor="name">Crop Name</label>
                                <input onChange={handleNameChange} value={cropName} type="text" required />

                                <label htmlFor="cprice">Crop Price</label>
                                <input onChange={handlePriceChange} type="number" id='price' value={cropPrice} name='cprice' step="0.01" min="0" placeholder='0.00' required />
                            
                            </form>
                            <div className={styles.btn}>
                            <button>UPDATE</button>
                            <button onClick={()=> setEditPriceIsVisible(false)}>Cancel</button>
                         </div>
                    </div> </div>}
               
            </div>
        </>
    );
}

export default Dashboard;