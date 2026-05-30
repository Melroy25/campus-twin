import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase/config';
import { toast } from 'react-hot-toast';
import { 
  MdChat, MdClose, MdRefresh, MdSend, 
  MdAttachFile, MdContentCopy, MdCheck, MdInfo, 
  MdOutlineSmartToy, MdEventNote, MdList,
  MdVolumeUp, MdPause, MdPlayArrow, MdStop
} from 'react-icons/md';
import './ChatbotWidget.css';

export default function ChatbotWidget() {
  const { userProfile, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Active view: 'chat' or 'guide'
  const [activeTab, setActiveTab] = useState('chat');
  const [welcomeBubble, setWelcomeBubble] = useState(true);
  const [userName, setUserName] = useState('');
  const [needsName, setNeedsName] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [attachedImage, setAttachedImage] = useState(null); // { file, base64, previewUrl }
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  // Text-to-Speech states
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [speechState, setSpeechState] = useState('stopped'); // 'playing', 'paused', 'stopped'

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Global env key (set once in .env, works for all users)
  const globalKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const runMode = globalKey ? 'ai' : 'demo';

  // Initialize name, welcome bubble, and chat history from local/session storage
  useEffect(() => {
    const savedWelcomeClosed = localStorage.getItem('sjec_assistant_welcome_closed') === 'true';
    if (savedWelcomeClosed) {
      setWelcomeBubble(false);
    }

    if (!currentUser?.uid) return;

    // Try loading saved chat history first
    const savedHistory = localStorage.getItem(`sjec_chat_history_${currentUser.uid}`);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setMessages(parsed);
        setNeedsName(false);
        const savedName = sessionStorage.getItem('sjec_assistant_user_name') || (userProfile?.name ? userProfile.name.split(' ')[0] : 'User');
        setUserName(savedName);
        return; // Skip greeting onboarding if history exists
      } catch (e) {
        console.error("Failed to parse chat history:", e);
      }
    }

    // Default onboarding greeting
    const sessionName = sessionStorage.getItem('sjec_assistant_user_name');
    if (sessionName) {
      setUserName(sessionName);
      setNeedsName(false);
      initializeChat(sessionName);
    } else if (userProfile?.name) {
      const defaultName = userProfile.name.split(' ')[0];
      setUserName(defaultName);
      initializeNameGreeting(defaultName);
    } else {
      initializeNameGreeting('');
    }
  }, [userProfile, currentUser]);

  // Scroll to bottom whenever messages change or loading changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Persist chat history to localStorage whenever messages change
  useEffect(() => {
    if (currentUser?.uid && messages.length > 0) {
      localStorage.setItem(`sjec_chat_history_${currentUser.uid}`, JSON.stringify(messages));
    }
  }, [messages, currentUser]);

  // Start with greeting prompt
  const initializeNameGreeting = (prefilledName) => {
    setMessages([
      { role: 'assistant', text: 'Hello. I would be happy to help you today.', id: 'init-1' },
      { role: 'assistant', text: 'To get started, may I know your name?', id: 'init-2', isNamePrompt: true }
    ]);
    if (prefilledName) {
      setInputVal(prefilledName);
    }
  };

  // Welcome user once name is known
  const initializeChat = (name) => {
    setMessages([
      { role: 'assistant', text: 'Hello. I would be happy to help you today.', id: 'init-1' },
      { role: 'assistant', text: `Hi ${name}! I'm your SJEC Assistant. I can help you explain concepts, draft formal letters, and analyze event posters.`, id: 'init-3' }
    ]);
  };

  // Close welcome bubble permanently
  const closeWelcomeBubble = (e) => {
    e.stopPropagation();
    setWelcomeBubble(false);
    localStorage.setItem('sjec_assistant_welcome_closed', 'true');
  };

  // Reset/Restart Conversation
  const handleRestart = () => {
    if (window.confirm("Are you sure you want to delete this conversation and start over?")) {
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
      setSpeechState('stopped');
      
      if (currentUser?.uid) {
        localStorage.removeItem(`sjec_chat_history_${currentUser.uid}`);
      }
      
      setMessages([]);
      setInputVal('');
      setAttachedImage(null);
      setLoading(false);
      setNeedsName(true);
      
      const defaultName = userProfile?.name ? userProfile.name.split(' ')[0] : '';
      initializeNameGreeting(defaultName);
      setActiveTab('chat');
    }
  };

  // Text-to-Speech playback cleanups
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
      setSpeechState('stopped');
    }
  }, [isOpen]);

  const getSpeakableText = (text) => {
    return text
      .replace(/\[DRAFT_START\]/gi, '')
      .replace(/\[DRAFT_END\]/gi, '')
      .replace(/\[EVENT_INFO\][\s\S]*?\[END_EVENT_INFO\]/gi, '') // Strip raw event data block
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .trim();
  };

  const handleSpeakToggle = (msgId, text) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    const cleanText = getSpeakableText(text);

    if (speakingMsgId === msgId) {
      if (speechState === 'playing') {
        synth.pause();
        setSpeechState('paused');
      } else if (speechState === 'paused') {
        synth.resume();
        setSpeechState('playing');
      }
    } else {
      synth.cancel();
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => {
        setSpeakingMsgId(null);
        setSpeechState('stopped');
      };
      utterance.onerror = () => {
        setSpeakingMsgId(null);
        setSpeechState('stopped');
      };

      setSpeakingMsgId(msgId);
      setSpeechState('playing');
      synth.speak(utterance);
    }
  };

  const handleStopSpeech = () => {
    window.speechSynthesis?.cancel();
    setSpeakingMsgId(null);
    setSpeechState('stopped');
  };

  // Name submission handler
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    
    const name = inputVal.trim();
    setUserName(name);
    sessionStorage.setItem('sjec_assistant_user_name', name);
    setNeedsName(false);
    setInputVal('');

    // Append name bubble & assistant's onboarding options
    setMessages(prev => [
      ...prev,
      { role: 'user', text: name, id: `user-name-${Date.now()}` },
      { 
        role: 'assistant', 
        text: `Awesome, nice to meet you, **${name}**! Here are some features I can help you with:`, 
        id: `welcome-${Date.now()}`,
        showChips: true
      }
    ]);
  };

  // Handle Paste event for clipboard image capture (Ctrl+V)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileProcessing(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Process selected image file
  const handleFileProcessing = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setAttachedImage({
        file: file,
        base64: reader.result.split(',')[1],
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type
      });
      toast.success("Image attached! Press Send to analyze.");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
    };
  };

  // File upload change trigger
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcessing(file);
    }
  };

  // Remove attached image
  const removeAttachedImage = () => {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse extracted event details from bot message
  const parseEventDetails = (text) => {
    const match = text.match(/\[EVENT_INFO\]([\s\S]*?)\[END_EVENT_INFO\]/);
    if (!match) return null;

    const content = match[1];
    const titleMatch = content.match(/Title:\s*(.*)/);
    const dateMatch = content.match(/Date:\s*(.*)/);
    const venueMatch = content.match(/Venue:\s*(.*)/);
    const descMatch = content.match(/Description:\s*(.*)/);
    const contactMatch = content.match(/Contact:\s*(.*)/);

    return {
      title: titleMatch ? titleMatch[1].trim() : 'Unknown Event',
      date: dateMatch ? dateMatch[1].trim() : '',
      venue: venueMatch ? venueMatch[1].trim() : '',
      description: descMatch ? descMatch[1].trim() : '',
      contact: contactMatch ? contactMatch[1].trim() : '',
      rawBlock: match[0]
    };
  };

  // Copy formal message draft or text to clipboard
  const handleCopyText = (text, id) => {
    let cleanText = text;
    // Extract text between draft tags if present
    const draftMatch = text.match(/\[DRAFT_START\]([\s\S]*?)\[DRAFT_END\]/);
    if (draftMatch) {
      cleanText = draftMatch[1].trim();
    }
    
    navigator.clipboard.writeText(cleanText)
      .then(() => {
        setCopiedId(id);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy text.");
      });
  };

  // Add event details directly to SQL task lists (Supabase / LocalStorage fallback)
  const handleAddEventToTasks = async (eventDetails) => {
    const taskTitle = `Attend: ${eventDetails.title}`;
    
    // Parse Date to YYYY-MM-DD, always fall back to today
    let dueDate = new Date().toISOString().split('T')[0]; // default to today
    if (eventDetails.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(eventDetails.date)) {
        dueDate = eventDetails.date;
      } else {
        const parsed = new Date(eventDetails.date);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed.toISOString().split('T')[0];
        }
      }
    }

    // Check auth role (Supabase is only active for students in Campus Twin)
    const isStudent = userProfile?.role === 'student';
    if (currentUser?.uid && isStudent) {
      try {
        const serializedTitle = JSON.stringify({
          text: taskTitle,
          priority: 'medium'
        });

        const { error } = await supabase
          .from('todos')
          .insert([{
            student_id: currentUser.uid,
            title: serializedTitle,
            due_date: dueDate,
            is_completed: false
          }]);

        if (error) throw error;
        toast.success("Event added to your dashboard tasks!");
        window.dispatchEvent(new CustomEvent('sjec-todo-updated'));
      } catch (err) {
        console.error("Supabase insert error:", err);
        toast.error("Failed to sync task. Saved to local storage instead.");
        saveToLocalStorageTasks(taskTitle, dueDate);
        window.dispatchEvent(new CustomEvent('sjec-todo-updated'));
      }
    } else {
      // LocalStorage backup for Admins/Teachers/Mentors or unauthenticated tests
      saveToLocalStorageTasks(taskTitle, dueDate);
      window.dispatchEvent(new CustomEvent('sjec-todo-updated'));
    }
  };

  // Local storage task saver helper
  const saveToLocalStorageTasks = (title, dueDate) => {
    try {
      const existing = JSON.parse(localStorage.getItem('sjec_assistant_local_tasks') || '[]');
      existing.push({
        id: `local-task-${Date.now()}`,
        title: title,
        due_date: dueDate || new Date().toISOString().split('T')[0],
        completed: false
      });
      localStorage.setItem('sjec_assistant_local_tasks', JSON.stringify(existing));
      toast.success("Saved to your local browser tasks!");
    } catch (e) {
      toast.error("Failed to save task.");
    }
  };

  // Send Message Logic
  const handleSendMessage = async (e, customText = '') => {
    if (e) e.preventDefault();
    
    const textToSend = customText || inputVal;
    if (!textToSend.trim() && !attachedImage) return;

    setInputVal('');
    const userMsgId = `msg-${Date.now()}`;
    const userMessageObj = {
      role: 'user',
      text: textToSend,
      id: userMsgId,
      image: attachedImage ? attachedImage.previewUrl : null
    };

    setMessages(prev => [...prev, userMessageObj]);
    setLoading(true);

    const imageToSend = attachedImage;
    removeAttachedImage();

    try {
      let aiResponseText = '';

      if (runMode === 'demo') {
        // Run simulated responses
        aiResponseText = await simulateMockResponse(textToSend, imageToSend);
      } else {
        // Live Gemini API call
        if (!globalKey) {
          throw new Error("Gemini API Key is not configured. Please add VITE_GEMINI_API_KEY in your .env file.");
        }
        aiResponseText = await callGeminiAPI(textToSend, imageToSend, globalKey);
      }

      const botMsgId = `bot-${Date.now()}`;
      const eventDetails = parseEventDetails(aiResponseText);
      
      // Strip out raw event tags for clean display
      let cleanResponse = aiResponseText;
      if (eventDetails) {
        cleanResponse = aiResponseText.replace(eventDetails.rawBlock, '').trim();
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: cleanResponse,
          id: botMsgId,
          eventDetails: eventDetails
        }
      ]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ **Error**: ${error.message || "Failed to contact AI service. Please make sure VITE_GEMINI_API_KEY is configured in your .env file."}`,
          id: `err-${Date.now()}`
        }
      ]);
      toast.error("AI service failure");
    } finally {
      setLoading(false);
    }
  };

  // Call actual Gemini API Endpoint
  const callGeminiAPI = async (prompt, imageObj, keyToUse) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToUse}`;
    
    // Construct system instructions
    const systemPrompt = `You are SJEC Assistant, a helpful AI campus companion for St Joseph Engineering College. 
You explain academic concepts clearly, draft formal letters/emails (like leave requests, event permissions, class announcements), and analyze event posters to extract dates, venues, and descriptions. 

Always keep your tone polite, encouraging, and clear. 

For message drafting:
Wrap your formal draft template between [DRAFT_START] and [DRAFT_END] tags. E.g.
[DRAFT_START]
Subject: ...
Dear Sir/Madam,
...
[DRAFT_END]

For poster analyses:
If the user uploads an image, analyze it. Extract key information. At the very end of your response, ALWAYS append a structured block enclosed in [EVENT_INFO] and [END_EVENT_INFO] using this exact template format:
[EVENT_INFO]
Title: <Event Title or Hackathon Name>
Date: <Event Date in YYYY-MM-DD format if possible, otherwise write the date range as seen>
Venue: <Room/Auditorium/Campus Venue>
Description: <Single sentence summarizing the event>
Contact: <Email or phone numbers if visible>
[END_EVENT_INFO]`;

    let parts = [{ text: prompt || "Explain this poster or query" }];
    
    if (imageObj && imageObj.base64) {
      parts.push({
        inlineData: {
          mimeType: imageObj.mimeType || 'image/jpeg',
          data: imageObj.base64
        }
      });
    }

    // Build historical message turns
    const contents = [];
    // Only send the last 6 messages to avoid hitting prompt limits & keep context clean
    const recentChat = messages
      .filter(m => !m.isNamePrompt && m.id !== 'init-1' && m.id !== 'init-2')
      .slice(-6);

    recentChat.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });

    contents.push({
      role: 'user',
      parts: parts
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API request failed (status ${response.status})`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response returned.";
  };

  // Mock responses for Demo Mode
  const simulateMockResponse = async (prompt, imageObj) => {
    await new Promise(r => setTimeout(r, 1200));
    const query = prompt.toLowerCase();

    if (imageObj) {
      return `I have analyzed the event poster image you sent. 

The poster announces **SJEC Innovate Hackathon 2026**, a collegiate hackathon organized by the Computer Science and Engineering Department of SJEC. It challenges students to build prototypes tackling sustainable development goals (SDGs). 

Here are the extracted details:
* **Event Name**: Innovate Hackathon 2026
* **Date**: May 28, 2026 (Registration deadline is May 26)
* **Venue**: CSE Seminar Hall & Incubation Center (3rd Floor, PG Block)
* **Prizes**: Winner gets cash prizes worth ₹20,000!

You can save this event directly to your dashboard task list by clicking the button below!

[EVENT_INFO]
Title: Innovate Hackathon 2026
Date: 2026-05-28
Venue: CSE Seminar Hall, PG Block
Description: Student prototype building contest focused on Sustainable Development Goals.
Contact: innovate@sjec.edu.in
[END_EVENT_INFO]

*(Demo Mode - Configure your Gemini API Key in chatbot settings to use live AI analysis!)*`;
    }

    if (query.includes('leave') || query.includes('sick') || query.includes('permission') || query.includes('draft')) {
      return `Sure, here is a formal draft for your leave application. You can copy it directly using the copy icon:

[DRAFT_START]
Subject: Application for Sick Leave

Dear Professor,

I am writing to request sick leave from my classes from May 25th to May 27th, 2026, due to a severe viral fever. My doctor has advised complete rest for recovery.

I will ensure to coordinate with my classmates to catch up on the lectures missed and complete any pending assignments upon my return. Thank you for your understanding.

Sincerely,
[Your Name]
[USN / Roll Number]
[Class & Section]
[DRAFT_END]

*(Demo Mode - Add your VITE_GEMINI_API_KEY in .env file to activate live AI drafts!)*`;
    }

    if (query.includes('explain') || query.includes('concept') || query.includes('what is') || query.includes('how does')) {
      return `Here is an explanation of the concept you requested:

### **Time Complexity**
In Computer Science, **Time Complexity** is the computational complexity that describes the amount of computer time it takes to run an algorithm. It is commonly estimated by counting the number of elementary operations performed.

**Big O Notation** is used to classify algorithms according to how their run time or space requirements grow as the input size ($n$) grows:
*   **$O(1)$ - Constant Time**: Execution time remains the same regardless of input size (e.g. accessing array index).
*   **$O(n)$ - Linear Time**: Time grows proportionally to input size (e.g. linear search).
*   **$O(\log n)$ - Logarithmic Time**: Time increases logarithmically, dividing the search space in half each step (e.g. binary search).
*   **$O(n^2)$ - Quadratic Time**: Performance is directly proportional to the square of the input size (e.g. bubble sort).

*(Demo Mode - Add your VITE_GEMINI_API_KEY in .env file for live answers to any concept!)*`;
    }

    return `Hi ${userName}! 

I'm currently running in **Demo Mode**. 
To get live responses to any query, add ` + "`VITE_GEMINI_API_KEY`" + ` in your ` + "`.env`" + ` file at the project root.

Here is what you can try in Demo Mode:
1. Ask me to "draft a sick leave letter".
2. Ask me to "explain the concept of binary trees".
3. Upload or paste a poster image (like a screenshot) using Ctrl+V to see how event detail extraction works!`;
  };

  // Quick Action Click Dispatcher
  const handleQuickAction = (action) => {
    let promptText = '';
    let responseText = '';
    
    if (action === 'draft') {
      promptText = 'Draft a message';
      responseText = `I can help you draft formal emails and letters. What would you like to draft? 

Choose one of these quick templates or type your request:
*   **Sick Leave Request** (due to illness)
*   **Hackathon Permission** (to attend off-campus competition)
*   **Event Announcement** (to promote a student chapter event)`;
    } else if (action === 'explain') {
      promptText = 'Explain a concept';
      responseText = `What academic topic or programming concept would you like me to explain? 

Examples:
*   *What is normalisation in databases?*
*   *Explain how React useEffect works.*
*   *Tell me about the Quick Sort algorithm.*`;
    } else if (action === 'poster') {
      promptText = 'Analyze poster';
      responseText = `Please attach or paste (Ctrl+V) an event poster. 

I will read the text, extract dates, times, venues, and summary, and let you add it to your tasks list. Click the paperclip icon below to select an image, or copy a screenshot and paste it.`;
    } else if (action === 'guide') {
      setActiveTab('guide');
      return;
    } else if (action === 'draft_sick') {
      handleSendMessage(null, "Draft a formal sick leave application letter");
      return;
    } else if (action === 'draft_hack') {
      handleSendMessage(null, "Draft a formal permission letter to attend an off-campus hackathon with attendance compensation");
      return;
    } else if (action === 'draft_event') {
      handleSendMessage(null, "Draft a formal WhatsApp announcement message for a student club event");
      return;
    }

    if (promptText && responseText) {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: promptText, id: `action-req-${Date.now()}` },
        { 
          role: 'assistant', 
          text: responseText, 
          id: `action-res-${Date.now()}`,
          showSubChips: action === 'draft'
        }
      ]);
    }
  };

  // Render text with simple bold and list markdown parsing
  const formatMessageText = (text) => {
    // Escape simple tags first to display code blocks
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace Bold markdown **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace Italics *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Replace inline code `code`
    formatted = formatted.replace(/`(.*?)`/g, '<code class="cb-inline-code">$1</code>');
    
    // Check if the text contains a codeblock [DRAFT_START] ... [DRAFT_END]
    const draftMatch = formatted.match(/\[DRAFT_START\]([\s\S]*?)\[DRAFT_END\]/);
    
    if (draftMatch) {
      const parts = formatted.split(/\[DRAFT_START\][\s\S]*?\[DRAFT_END\]/);
      const draftContent = draftMatch[1].trim();
      
      return (
        <div>
          <div dangerouslySetInnerHTML={{ __html: parts[0] }} />
          <div className="cb-draft-container">
            <div className="cb-draft-header">
              <span>📝 FORMAL DRAFT</span>
              <button 
                className="cb-draft-copy-btn" 
                onClick={() => handleCopyText(draftContent, 'draft-btn')}
              >
                {copiedId === 'draft-btn' ? <MdCheck size={14} /> : <MdContentCopy size={14} />}
                {copiedId === 'draft-btn' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="cb-draft-body">{draftContent}</pre>
          </div>
          <div dangerouslySetInnerHTML={{ __html: parts[1] }} />
        </div>
      );
    }

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="cb-wrapper">
      {/* Collapsed Toggle Button & Speech Bubble */}
      {!isOpen && (
        <div className="cb-collapsed-container">
          {welcomeBubble && (
            <div className="cb-welcome-bubble">
              <span>Hi, I am here to help.</span>
              <button className="cb-welcome-bubble-close" onClick={closeWelcomeBubble}>
                <MdClose />
              </button>
            </div>
          )}
          <button className="cb-toggle-btn" onClick={() => setIsOpen(true)}>
            <div className="cb-toggle-icon">
              <MdOutlineSmartToy />
            </div>
          </button>
        </div>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="cb-window">
          {/* Header */}
          <div className="cb-header">
            <div className="cb-header-info">
              <h3 className="cb-header-title">
                <MdOutlineSmartToy /> SJEC Assistant
              </h3>
              <p className="cb-header-subtitle">Campus Companion & AI Guide</p>
            </div>
            <div className="cb-header-actions">
              <button 
                className="cb-icon-btn" 
                title="Restart Conversation" 
                onClick={handleRestart}
              >
                <MdRefresh />
              </button>
              <button 
                className={`cb-icon-btn ${activeTab === 'guide' ? 'active' : ''}`}
                title="Feature Guide"
                onClick={() => setActiveTab(prev => prev === 'guide' ? 'chat' : 'guide')}
              >
                <MdInfo />
              </button>
              <button 
                className="cb-icon-btn" 
                title="Minimize" 
                onClick={() => setIsOpen(false)}
              >
                <MdClose />
              </button>
            </div>
          </div>

          {/* Tab Panes */}
          <div className="cb-body">
            {activeTab === 'chat' && (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`cb-message-row ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="cb-chat-avatar assistant">
                        <MdOutlineSmartToy size={16} />
                      </div>
                    )}
                    <div className={`cb-message-wrapper ${msg.role}`}>
                      <div className="cb-message-bubble">
                        {msg.image && (
                          <img src={msg.image} alt="attached" className="cb-message-image" />
                        )}
                        {formatMessageText(msg.text)}
                      </div>

                      {msg.role === 'assistant' && !msg.isNamePrompt && (
                        <div className="cb-message-actions">
                          <button 
                            type="button"
                            className={`cb-msg-action-btn ${speakingMsgId === msg.id ? 'active' : ''}`}
                            onClick={() => handleSpeakToggle(msg.id, msg.text)}
                            title={speakingMsgId === msg.id && speechState === 'playing' ? "Pause reading" : "Read message out loud"}
                          >
                            {speakingMsgId === msg.id && speechState === 'playing' ? <MdPause size={14} /> : 
                             speakingMsgId === msg.id && speechState === 'paused' ? <MdPlayArrow size={14} /> : 
                             <MdVolumeUp size={14} />}
                          </button>
                          {speakingMsgId === msg.id && (
                            <button 
                              type="button"
                              className="cb-msg-action-btn stop"
                              onClick={handleStopSpeech}
                              title="Stop reading"
                            >
                              <MdStop size={14} />
                            </button>
                          )}
                          <button 
                            type="button"
                            className="cb-msg-action-btn" 
                            onClick={() => handleCopyText(msg.text, msg.id)}
                            title="Copy text"
                          >
                            {copiedId === msg.id ? <MdCheck size={14} /> : <MdContentCopy size={14} />}
                          </button>
                        </div>
                      )}
                      
                      {/* Render extracted event details if parsed */}
                      {msg.eventDetails && (
                        <div className="cb-extraction-box">
                          <div className="cb-extraction-title">
                            <MdEventNote style={{ verticalAlign: 'middle', marginRight: 6 }} /> Extracted Event Details
                          </div>
                          <div className="cb-extraction-row">
                            <div className="cb-extraction-label">Event Title:</div>
                            <div className="cb-extraction-value">{msg.eventDetails.title}</div>
                          </div>
                          {msg.eventDetails.date && (
                            <div className="cb-extraction-row">
                              <div className="cb-extraction-label">Date:</div>
                              <div className="cb-extraction-value">{msg.eventDetails.date}</div>
                            </div>
                          )}
                          {msg.eventDetails.venue && (
                            <div className="cb-extraction-row">
                              <div className="cb-extraction-label">Venue:</div>
                              <div className="cb-extraction-value">{msg.eventDetails.venue}</div>
                            </div>
                          )}
                          {msg.eventDetails.description && (
                            <div className="cb-extraction-row">
                              <div className="cb-extraction-label">Summary:</div>
                              <div className="cb-extraction-value">{msg.eventDetails.description}</div>
                            </div>
                          )}
                          {msg.eventDetails.contact && (
                            <div className="cb-extraction-row">
                              <div className="cb-extraction-label">Contact:</div>
                              <div className="cb-extraction-value">{msg.eventDetails.contact}</div>
                            </div>
                          )}
                          <div className="cb-extraction-actions">
                            <button 
                              className="cb-extraction-action-btn"
                              onClick={() => handleCopyText(`${msg.eventDetails.title}\nDate: ${msg.eventDetails.date}\nVenue: ${msg.eventDetails.venue}`, 'event-copy')}
                            >
                              <MdContentCopy size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Copy Details
                            </button>
                            {userProfile?.role === 'student' && (
                              <button 
                                className="cb-extraction-action-btn"
                                onClick={() => handleAddEventToTasks(msg.eventDetails)}
                              >
                                <MdList size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Add to Tasks
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quick action chips triggers */}
                      {msg.showChips && (
                        <div className="cb-chips-container">
                          <button className="cb-chip" onClick={() => handleQuickAction('draft')}>📝 Draft Message</button>
                          <button className="cb-chip" onClick={() => handleQuickAction('explain')}>💡 Explain Concept</button>
                          <button className="cb-chip" onClick={() => handleQuickAction('poster')}>🖼️ Analyze Poster</button>
                          <button className="cb-chip" onClick={() => handleQuickAction('guide')}>📖 Feature Guide</button>
                        </div>
                      )}

                      {/* Sub quick action chips for drafts */}
                      {msg.showSubChips && (
                        <div className="cb-chips-container">
                          <button className="cb-chip" onClick={() => handleQuickAction('draft_sick')}>🤒 Sick Leave</button>
                          <button className="cb-chip" onClick={() => handleQuickAction('draft_hack')}>🏆 Hackathon Perm.</button>
                          <button className="cb-chip" onClick={() => handleQuickAction('draft_event')}>📣 Event Announce.</button>
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="cb-chat-avatar user">
                        {userProfile?.avatar_url ? (
                          <img src={userProfile.avatar_url} alt="User Avatar" className="cb-avatar-img" />
                        ) : (
                          <span className="cb-avatar-initials">
                            {(userProfile?.name || userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Thinking loader */}
                {loading && (
                  <div className="cb-message-row assistant">
                    <div className="cb-chat-avatar assistant">
                      <MdOutlineSmartToy size={16} />
                    </div>
                    <div className="cb-skeleton-wrapper">
                      <div className="cb-skeleton-bubble">
                        <div className="cb-skeleton-line"></div>
                        <div className="cb-skeleton-line"></div>
                        <div className="cb-skeleton-line"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* Guide Pane */}
            {activeTab === 'guide' && (
              <div className="cb-guide-container">
                <button type="button" className="cb-back-link" onClick={() => setActiveTab('chat')}>
                  ← Back to Chat
                </button>
                <div className="cb-guide-hero">
                  <h4>💡 What can I do?</h4>
                  <p>I am your general assistant and AI academic buddy. Here is how I can make your college life easier:</p>
                </div>
                
                <div className="cb-guide-section">
                  <div className="cb-guide-item">
                    <div className="cb-guide-icon">💬</div>
                    <div className="cb-guide-content">
                      <h5>Explain Academic Concepts</h5>
                      <p>Ask me to explain normalisation, React hooks, big O, or compile theory. I will explain it with clean breakdowns.</p>
                    </div>
                  </div>

                  <div className="cb-guide-item">
                    <div className="cb-guide-icon">✉️</div>
                    <div className="cb-guide-content">
                      <h5>Draft Formal Messages</h5>
                      <p>Need to email a teacher for leaves, or permission for events? Select a template and copy a polished formal draft instantly.</p>
                    </div>
                  </div>

                  <div className="cb-guide-item">
                    <div className="cb-guide-icon">🖼️</div>
                    <div className="cb-guide-content">
                      <h5>Event Poster Analyzer</h5>
                      <p>Take a screenshot of any campus poster, paste it here (Ctrl+V), and I will extract dates, venue, details, and add it directly to your personal task list!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>

          {/* Footer Input Bar */}
          {activeTab === 'chat' && (
            <div className="cb-footer">
              {/* Attached Image Preview */}
              {attachedImage && (
                <div className="cb-preview-container">
                  <img src={attachedImage.previewUrl} alt="upload preview" className="cb-preview-thumbnail" />
                  <span className="cb-preview-name">{attachedImage.file.name}</span>
                  <button className="cb-preview-remove" onClick={removeAttachedImage}>
                    <MdClose size={12} />
                  </button>
                </div>
              )}

              {needsName ? (
                <form onSubmit={handleNameSubmit} className="cb-input-row">
                  <input 
                    type="text"
                    className="cb-input"
                    placeholder="Enter your name..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="cb-action-btn cb-send-btn" disabled={!inputVal.trim()}>
                    <MdSend size={18} />
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => handleSendMessage(e)} className="cb-input-row">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept="image/*"
                  />
                  <button 
                    type="button" 
                    className="cb-action-btn cb-attach-btn"
                    title="Attach Poster Image"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <MdAttachFile size={18} />
                  </button>
                  <textarea 
                    className="cb-input"
                    placeholder="Ask assistant or paste screenshot..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(null);
                      }
                    }}
                    onPaste={handlePaste}
                    rows={1}
                  />
                  <button 
                    type="submit" 
                    className="cb-action-btn cb-send-btn"
                    disabled={!inputVal.trim() && !attachedImage}
                  >
                    <MdSend size={18} />
                  </button>
                </form>
              )}
              
              {!needsName && (
                <div className="cb-footer-hint">
                  Powered by <strong>Melroy's creation</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
