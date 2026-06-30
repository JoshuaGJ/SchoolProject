import styles from './search.module.css'
//import React, {useState} from 'react';
function SearchPage(){

   // const [markets, setMarket] = useState();
    const List = [
        {name:"kameValley",price:"10000"},
         {name:"kameValley",price:"10000"},
          {name:"kameValley",price:"10000"},
           {name:"kameValley",price:"10000"},
            {name:"kameValley",price:"10000"},
             {name:"kameValley",price:"10000"},
              {name:"kameValley",price:"10000"},
               {name:"kameValley",price:"10000"},
        {name:"kameValley",price:"10000"},
         {name:"kameValley",price:"10000"},
          {name:"kameValley",price:"10000"},
           {name:"kameValley",price:"10000"},
            {name:"kameValley",price:"10000"},
             {name:"kameValley",price:"10000"},
              {name:"kameValley",price:"10000"},
               {name:"kameValley",price:"10000"}

            ]

    const dispList = List.map(
        list=> <li>
            {list.name}:
            &nbsp
            {list.price}
        </li>
    )

    return(
        <>
            <div className={styles.container}>
                <div className={styles.head}>
                    <h1>BEYI</h1>
                </div>

                <div className={styles.body}>
                
                    <form className={styles.searchcontainer}>
                        
                        <input type="text" id="cropSearch" placeholder="Search for a crop (e.g. Maize)..." aria-label="Search crops"/>
                       
                        <button type="submit" className={styles.searchicon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    
                    </form>

                     <div className={styles.map}>
                            <p>Nearby Markets</p>

                            <div className={styles.mapbox}></div>
                     </div>

                     <div className={styles.circles}>
                        <div className={styles.circle}>
                            <p>markerName</p>
                            <p>cropName</p>
                            <p>1000</p>
                        </div>
                        <div className={styles.circle}>
                            <p>markerName</p>
                            <p>cropName</p>
                            <p>1000</p>
                        </div>
                        <div className={styles.circle}>
                            <p>markerName</p>
                            <p>cropName</p>
                            <p>1000</p>
                        </div>
                     </div>
                    
                    <div className={styles.compare}>
                        <h4>Other Markets</h4>
                         <form className={styles.filter}>
                        
                        <input type="text" id="cropSearch" placeholder="Search for market" aria-label="Search crops"/>
                       
                        <button type="submit" className={styles.filtericon}>
                           🔗
                        </button>
                    
                    </form>

                    <ul>{dispList}</ul>
                    </div>
                </div>

            </div>
        </>
    );
}

export default SearchPage;