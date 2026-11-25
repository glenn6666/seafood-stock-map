import {useEffect,useState} from 'react';
import {taipeiDay} from './game-rules';
export function useTaipeiDay(){
 const [today,setToday]=useState(taipeiDay);
 useEffect(()=>{const timer=setInterval(()=>setToday(taipeiDay()),1000);return()=>clearInterval(timer)},[]);
 return today;
}
