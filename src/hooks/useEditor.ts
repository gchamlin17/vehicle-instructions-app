import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "../firebase";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

export function useEditor(){
  const [user,setUser] = useState<User|null>(null);
  const [isEditor,setIsEditor] = useState(false);
  const [allowedMakes,setAllowedMakes] = useState<string[]|null>(null);

  useEffect(()=> onAuthStateChanged(getAuth(app),(u)=>setUser(u)),[]);
  useEffect(()=>{
    if(!user){ setIsEditor(false); setAllowedMakes(null); return; }
    const ref = doc(getFirestore(), "editors", user.uid);
    return onSnapshot(ref, s => {
      const ok = s.exists(); setIsEditor(ok);
      setAllowedMakes(ok ? (s.data().allowedMakes || null) : null);
    });
  },[user]);
  return { user, isEditor, allowedMakes };
}