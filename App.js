import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, 
  updateDoc, doc, writeBatch, serverTimestamp, getDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  Calendar as CalendarIcon, Plus, Calculator, ShoppingCart, 
  User, IndianRupee, ChevronLeft, ChevronRight, 
  Users, Trash2, ShieldCheck, Clock, Copy, LogIn, CheckSquare, Square, ArrowRight, TrendingUp, History, ChevronDown, CalendarRange, CreditCard, PieChart, Activity, X, Lock, Wallet, Receipt, Box, LogOut, Mail, Key, UserCircle, Camera, Settings
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAul_z5lHJxjhBAWVS9Hl4gQqu9eAsz_gA",
  authDomain: "expense-manager-8ab68.firebaseapp.com",
  projectId: "expense-manager-8ab68",
  storageBucket: "expense-manager-8ab68.firebasestorage.app",
  messagingSenderId: "1037902572613",
  appId: "1:1037902572613:web:da5bfe60684a17c08bc72c",
  measurementId: "G-QBY7N12NSC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const artifactAppId = 'expense-manager-pro-v1'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState(''); 
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  // App States
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groceries, setGroceries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // UI States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCreateGroupModal, setIsCreateGroupModal] = useState(false);
  const [isJoinGroupModal, setIsJoinGroupModal] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // User Profile Modal State
  const [isPhotoEditMode, setIsPhotoEditMode] = useState(false);
  const [newPhotoURL, setNewPhotoURL] = useState('');
  const [historyGroupId, setHistoryGroupId] = useState(null); 
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calcView, setCalcView] = useState('personal');
  const [viewedGroupId, setViewedGroupId] = useState(null);
  const [isPersonalGroupExpanded, setIsPersonalGroupExpanded] = useState(false);

  // Date Filter States
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [filterEnd, setFilterEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Form Inputs
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [expenseType, setExpenseType] = useState('personal');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [groceryInput, setGroceryInput] = useState('');
  const [groceryType, setGroceryType] = useState('personal');

  // 1. Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user) return;

    // Listen to Groups
    const qGrp = query(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'groups'));
    const unsubGrp = onSnapshot(qGrp, (snap) => {
      const allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(allGroups.filter(g => Array.isArray(g.members) && g.members.some(m => m.uid === user.uid)));
    });

    // Listen to Activity Logs
    const qLogs = query(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'activity_logs'));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Public Expenses
    const qPublicExp = query(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'expenses'));
    const unsubPublicExp = onSnapshot(qPublicExp, (snap) => {
      const publicData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const qPrivateExp = query(collection(db, 'artifacts', artifactAppId, 'users', user.uid, 'expenses'));
      onSnapshot(qPrivateExp, (privateSnap) => {
        const privateData = privateSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses([...publicData, ...privateData]);
      });
    });

    // Listen to Groceries
    const qPublicGroc = query(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'groceries'));
    const unsubPublicGroc = onSnapshot(qPublicGroc, (snap) => {
      const publicGroc = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const qPrivateGroc = query(collection(db, 'artifacts', artifactAppId, 'users', user.uid, 'groceries'));
      onSnapshot(qPrivateGroc, (privateSnap) => {
        const privateData = privateSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setGroceries([...publicGroc, ...privateData]);
      });
    });

    return () => { unsubGrp(); unsubLogs(); unsubPublicExp(); unsubPublicGroc(); };
  }, [user]);

  // --- Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        if (!authName.trim()) throw new Error("Full Name is required");
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await updateProfile(userCredential.user, { displayName: authName });
        await setDoc(doc(db, 'artifacts', artifactAppId, 'public', 'data', 'user_directory', userCredential.user.uid), {
          name: authName,
          email: authEmail,
          photoURL: null
        });
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase:', ''));
    }
  };

  const handleUpdatePhoto = async (e) => {
    e.preventDefault();
    if (!newPhotoURL.trim()) return;
    try {
      await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
      await updateDoc(doc(db, 'artifacts', artifactAppId, 'public', 'data', 'user_directory', user.uid), {
        photoURL: newPhotoURL
      });
      setIsPhotoEditMode(false);
      setNewPhotoURL('');
      // Force refresh user in state
      setUser({ ...auth.currentUser });
    } catch (err) {
      console.error("Photo update failed:", err);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setIsProfileModalOpen(false);
  };

  const logActivity = async (groupId, action) => {
    if (!groupId || groupId === 'personal' || !user) return;
    try {
      const gName = groups.find(g => g.id === groupId)?.name || "Group";
      await addDoc(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'activity_logs'), {
        groupId,
        groupName: gName,
        userId: user.uid,
        userName: user.displayName || user.email.split('@')[0],
        action,
        timestamp: new Date().toISOString()
      });
    } catch (err) { console.error(err); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!itemName || !price || !user) return;
    const isGroup = expenseType !== 'personal';
    const groupData = isGroup ? groups.find(g => g.id === expenseType) : null;
    const payload = {
      itemName,
      price: parseFloat(price),
      type: expenseType,
      userId: user.uid,
      userName: user.displayName || user.email.split('@')[0],
      date: selectedDate.toISOString().split('T')[0],
      settled: false,
      memberCount: isGroup ? (groupData?.members?.length || 1) : 1,
      timestamp: serverTimestamp()
    };

    try {
      if (isGroup) {
        await addDoc(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'expenses'), payload);
        logActivity(expenseType, `Logged expense: ${itemName} (₹${price})`);
      } else {
        await addDoc(collection(db, 'artifacts', artifactAppId, 'users', user.uid, 'expenses'), payload);
      }
      setItemName(''); setPrice(''); setIsExpenseModalOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleDeleteExpense = async (exp) => {
    if (exp.settled) return;
    try {
      const ref = exp.type === 'personal' 
        ? doc(db, 'artifacts', artifactAppId, 'users', user.uid, 'expenses', exp.id)
        : doc(db, 'artifacts', artifactAppId, 'public', 'data', 'expenses', exp.id);
      await deleteDoc(ref);
      if (exp.type !== 'personal') logActivity(exp.type, `Deleted expense: ${exp.itemName}`);
    } catch (err) { console.error(err); }
  };

  const markGroupSettled = async (groupId) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      expenses.filter(e => e.type === groupId && !e.settled).forEach(exp => {
        batch.update(doc(db, 'artifacts', artifactAppId, 'public', 'data', 'expenses', exp.id), { settled: true });
      });
      const groupRef = doc(db, 'artifacts', artifactAppId, 'public', 'data', 'groups', groupId);
      batch.update(groupRef, {
        lastSettledAt: new Date().toISOString(),
        lastSettledBy: user.displayName || user.email.split('@')[0]
      });
      await batch.commit();
      logActivity(groupId, `Performed full settlement`);
    } catch (err) { console.error(err); }
  };

  const handleAddGrocery = async (e) => {
    e.preventDefault();
    if (!groceryInput.trim() || !user) return;
    const payload = {
      name: groceryInput,
      bought: false,
      type: groceryType,
      userId: user.uid,
      userName: user.displayName || user.email.split('@')[0],
      timestamp: serverTimestamp()
    };
    try {
      if (groceryType === 'personal') {
        await addDoc(collection(db, 'artifacts', artifactAppId, 'users', user.uid, 'groceries'), payload);
      } else {
        await addDoc(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'groceries'), payload);
        logActivity(groceryType, `Added to list: ${groceryInput}`);
      }
      setGroceryInput('');
    } catch (err) { console.error(err); }
  };

  const toggleGrocery = async (item) => {
    try { 
      const ref = item.type === 'personal'
        ? doc(db, 'artifacts', artifactAppId, 'users', user.uid, 'groceries', item.id)
        : doc(db, 'artifacts', artifactAppId, 'public', 'data', 'groceries', item.id);
      await updateDoc(ref, { bought: !item.bought });
      if (item.type !== 'personal') logActivity(item.type, `${item.bought ? 'Unchecked' : 'Checked'} ${item.name}`);
    } catch (err) { console.error(err); }
  };

  const deleteGroceryItem = async (item) => {
    try { 
      const ref = item.type === 'personal'
        ? doc(db, 'artifacts', artifactAppId, 'users', user.uid, 'groceries', item.id)
        : doc(db, 'artifacts', artifactAppId, 'public', 'data', 'groceries', item.id);
      await deleteDoc(ref);
      if (item.type !== 'personal') logActivity(item.type, `Removed from list: ${item.name}`);
    } catch (err) { console.error(err); }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName || !user) return;
    try {
      const groupRef = await addDoc(collection(db, 'artifacts', artifactAppId, 'public', 'data', 'groups'), {
        name: newGroupName,
        adminId: user.uid,
        createdAt: new Date().toISOString(),
        members: [{ uid: user.uid, name: user.displayName || 'Owner', joinedAt: new Date().toISOString() }],
        lastSettledAt: null,
        lastSettledBy: null
      });
      logActivity(groupRef.id, `Created the group`);
      setNewGroupName(''); setIsCreateGroupModal(false);
    } catch (err) { console.error(err); }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinGroupId || !user) return;
    try {
      const groupDocRef = doc(db, 'artifacts', artifactAppId, 'public', 'data', 'groups', joinGroupId);
      const groupDoc = await getDoc(groupDocRef);
      if (groupDoc.exists()) {
        const data = groupDoc.data();
        if (!data.members?.some(m => m.uid === user.uid)) {
          const updatedMembers = [...(data.members || []), { uid: user.uid, name: user.displayName || 'Member', joinedAt: new Date().toISOString() }];
          await updateDoc(groupDocRef, { members: updatedMembers });
          logActivity(joinGroupId, `Joined the group`);
          setJoinGroupId(''); setIsJoinGroupModal(false);
        }
      }
    } catch (err) { console.error(err); }
  };

  // --- Calculations ---
  const personalStats = useMemo(() => {
    if (!user) return { purePersonal: 0, groupShare: 0, total: 0, groupBreakdown: {} };
    let purePersonal = 0, groupShare = 0, groupBreakdown = {};
    expenses.forEach(e => {
      if (e.date >= filterStart && e.date <= filterEnd) {
        if (e.type === 'personal' && e.userId === user.uid) purePersonal += e.price;
        else if (e.type !== 'personal' && groups.some(g => g.id === e.type)) {
          const share = (e.price / (e.memberCount || 1));
          groupShare += share;
          const group = groups.find(g => g.id === e.type);
          const gName = group ? group.name : "Archived";
          groupBreakdown[gName] = (groupBreakdown[gName] || 0) + share;
        }
      }
    });
    return { purePersonal, groupShare, total: purePersonal + groupShare, groupBreakdown };
  }, [expenses, user, filterStart, filterEnd, groups]);

  const visibleGroceriesFiltered = useMemo(() => {
    if (!user || !Array.isArray(groceries)) return [];
    return groceries.filter(item => {
      if (!item || !item.type) return false;
      if (item.type === 'personal') return item.userId === user.uid;
      return groups.some(g => g.id === item.type);
    });
  }, [groceries, user, groups]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const days = [], firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    return days;
  };

  // --- AUTH SCREEN ---
  if (!user && !loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl shadow-slate-200 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-3 mb-10">
          <div className="bg-indigo-600 text-white w-16 h-16 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-indigo-100 mb-4">
            <IndianRupee size={32}/>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">FinTrack Pro</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</p>
        </div>

        {authError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-bold uppercase mb-6 text-center border border-red-100">
            {authError}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <div className="relative group">
              <UserCircle className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18}/>
              <input 
                required type="text" placeholder="Full Name" value={authName} onChange={(e) => setAuthName(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all"
              />
            </div>
          )}
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18}/>
            <input 
              required type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all"
            />
          </div>
          <div className="relative group">
            <Key className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18}/>
            <input 
              required type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all"
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
            {authMode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
            className="text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors"
          >
            {authMode === 'login' ? "Don't have an account? Create one" : "Have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );

  // --- DASHBOARD ---
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl pb-24 font-sans overflow-hidden border-x border-slate-200 relative text-slate-900">
      
      {/* --- REFRESHED HEADER WITH PROFILE --- */}
      <header className="bg-white p-6 pb-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="space-y-0.5">
          <h1 className="text-xl font-black text-slate-900 tracking-tighter flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-2xl shadow-lg">
              <IndianRupee size={18}/>
            </div> 
            FinTrack
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">Smart Spending</p>
        </div>
        
        {/* Profile Button Instead of Logout */}
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="relative w-11 h-11 rounded-2xl bg-indigo-50 border-2 border-white flex items-center justify-center overflow-hidden shadow-sm active:scale-90 transition-all"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-black text-indigo-600 uppercase">
              {(us
