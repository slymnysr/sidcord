import { configureStore, createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { api, type APIUser, type APIGuild, type APIChannel, type APIMessage, type APIMember, type APIReaction } from './api';

// ===== AUTH =====
interface AuthState {
  user: APIUser | null;
  loading: boolean;
  error: string | null;
}

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (input: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const r = await api.login(input);
      return r.user;
    } catch (e: any) {
      return rejectWithValue(e.message || 'Giriş başarısız');
    }
  },
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (
    input: { username: string; email: string; display_name: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const r = await api.register(input);
      return r.user;
    } catch (e: any) {
      return rejectWithValue(e.message || 'Kayıt başarısız');
    }
  },
);

export const fetchMe = createAsyncThunk('auth/me', async () => {
  return await api.me();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, loading: false, error: null } as AuthState,
  reducers: {
    logout(state) {
      api.logout();
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginThunk.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; })
      .addCase(loginThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(registerThunk.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(registerThunk.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; })
      .addCase(registerThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(fetchMe.fulfilled, (s, a) => { s.user = a.payload; })
      .addCase(fetchMe.rejected, (s) => { s.user = null; });
  },
});

// ===== GUILDS =====
interface GuildsState {
  list: APIGuild[];
  selectedId: string | null;
  loading: boolean;
}

export const fetchGuilds = createAsyncThunk('guilds/list', async () => {
  return await api.guilds.list();
});

export const createGuildThunk = createAsyncThunk(
  'guilds/create',
  async (name: string) => {
    return await api.guilds.create(name);
  },
);

const guildsSlice = createSlice({
  name: 'guilds',
  initialState: { list: [], selectedId: null, loading: false } as GuildsState,
  reducers: {
    selectGuild(state, action: PayloadAction<string>) {
      state.selectedId = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchGuilds.pending, (s) => { s.loading = true; })
     .addCase(fetchGuilds.fulfilled, (s, a) => {
       s.loading = false;
       s.list = a.payload;
       if (!s.selectedId && a.payload.length > 0) {
         s.selectedId = a.payload[0].id;
       }
     })
     .addCase(createGuildThunk.fulfilled, (s, a) => {
       s.list.push(a.payload);
       s.selectedId = a.payload.id;
     });
  },
});

// ===== CHANNELS =====
interface ChannelsState {
  byGuild: Record<string, APIChannel[]>;
  selectedId: string | null;
  loading: boolean;
}

export const fetchChannels = createAsyncThunk(
  'channels/list',
  async (guildId: string) => {
    const list = await api.guilds.channels(guildId);
    return { guildId, list };
  },
);

const channelsSlice = createSlice({
  name: 'channels',
  initialState: { byGuild: {}, selectedId: null, loading: false } as ChannelsState,
  reducers: {
    selectChannel(state, action: PayloadAction<string>) {
      state.selectedId = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchChannels.fulfilled, (s, a) => {
      s.byGuild[a.payload.guildId] = a.payload.list;
      const firstText = a.payload.list.find((c) => c.type !== 'voice');
      if (firstText && (!s.selectedId || !a.payload.list.find((c) => c.id === s.selectedId))) {
        s.selectedId = firstText.id;
      }
    });
  },
});

// ===== MESSAGES =====
interface MessagesState {
  byChannel: Record<string, APIMessage[]>;
  loading: boolean;
}

export const fetchMessages = createAsyncThunk(
  'messages/list',
  async (channelId: string) => {
    const list = await api.channels.messages(channelId);
    return { channelId, list: list.slice().reverse() };
  },
);

export const sendMessageThunk = createAsyncThunk(
  'messages/send',
  async (input: { channelId: string; content: string }) => {
    return await api.channels.sendMessage(input.channelId, input.content);
  },
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState: { byChannel: {}, loading: false } as MessagesState,
  reducers: {
    pushMessage(state, action: PayloadAction<APIMessage>) {
      const list = state.byChannel[action.payload.channel_id] ?? [];
      if (list.some((m) => m.id === action.payload.id)) return;
      list.push(action.payload);
      state.byChannel[action.payload.channel_id] = list;
    },
    updateMessage(state, action: PayloadAction<APIMessage>) {
      const list = state.byChannel[action.payload.channel_id] ?? [];
      const idx = list.findIndex((m) => m.id === action.payload.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...action.payload };
      }
    },
    removeMessage(state, action: PayloadAction<{ channel_id: string; id: string }>) {
      const list = state.byChannel[action.payload.channel_id] ?? [];
      state.byChannel[action.payload.channel_id] = list.filter((m) => m.id !== action.payload.id);
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMessages.fulfilled, (s, a) => {
      s.byChannel[a.payload.channelId] = a.payload.list;
    })
     .addCase(sendMessageThunk.fulfilled, (s, a) => {
       const list = s.byChannel[a.payload.channel_id] ?? [];
       if (!list.some((m) => m.id === a.payload.id)) {
         list.push(a.payload);
         s.byChannel[a.payload.channel_id] = list;
       }
     });
  },
});

// ===== USERS CACHE =====
interface UsersState {
  byId: Record<string, APIUser>;
}

const usersSlice = createSlice({
  name: 'users',
  initialState: { byId: {} } as UsersState,
  reducers: {
    upsertUser(state, action: PayloadAction<APIUser>) {
      state.byId[action.payload.id] = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMe.fulfilled, (s, a) => {
      s.byId[a.payload.id] = a.payload;
    })
     .addCase(loginThunk.fulfilled, (s, a) => {
       s.byId[a.payload.id] = a.payload;
     })
     .addCase(registerThunk.fulfilled, (s, a) => {
       s.byId[a.payload.id] = a.payload;
     });
  },
});

// ===== REACTIONS =====
interface ReactionsState {
  byMessage: Record<string, APIReaction[]>;
}

export const fetchReactions = createAsyncThunk(
  'reactions/list',
  async (messageId: string) => {
    const list = await api.reactions.list(messageId);
    return { messageId, list };
  },
);

export const toggleReactionThunk = createAsyncThunk(
  'reactions/toggle',
  async (input: { messageId: string; emoji: string; isAdding: boolean }) => {
    if (input.isAdding) await api.reactions.add(input.messageId, input.emoji);
    else await api.reactions.remove(input.messageId, input.emoji);
    const list = await api.reactions.list(input.messageId);
    return { messageId: input.messageId, list };
  },
);

const reactionsSlice = createSlice({
  name: 'reactions',
  initialState: { byMessage: {} } as ReactionsState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchReactions.fulfilled, (s, a) => {
      s.byMessage[a.payload.messageId] = a.payload.list;
    })
     .addCase(toggleReactionThunk.fulfilled, (s, a) => {
       s.byMessage[a.payload.messageId] = a.payload.list;
     });
  },
});

// ===== MEMBERS =====
interface MembersState {
  byGuild: Record<string, APIMember[]>;
}

export const fetchMembers = createAsyncThunk(
  'members/list',
  async (guildId: string) => {
    const list = await api.guilds.members(guildId);
    return { guildId, list };
  },
);

const membersSlice = createSlice({
  name: 'members',
  initialState: { byGuild: {} } as MembersState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMembers.fulfilled, (s, a) => {
      s.byGuild[a.payload.guildId] = a.payload.list;
    });
  },
});

// ===== INVITES =====
export const acceptInviteThunk = createAsyncThunk(
  'invites/accept',
  async (code: string, { dispatch, rejectWithValue }) => {
    try {
      const guild = await api.invites.accept(code);
      // Sunucu listesini yenile, yeni katılan guild seçili gelsin
      await dispatch(fetchGuilds());
      return guild;
    } catch (e: any) {
      return rejectWithValue(e.message || 'Davet kabul edilemedi');
    }
  },
);

// ===== PRESENCE =====
interface PresenceState {
  onlineByGuild: Record<string, string[]>;
  voiceByChannel: Record<string, string[]>;
}

export const fetchVoicePresence = createAsyncThunk(
  'presence/voice',
  async (channelIds: string[]) => {
    if (channelIds.length === 0) return {};
    const params = new URLSearchParams({ channels: channelIds.join(',') });
    const res = await fetch(`/voice-api/presence?${params}`);
    return (await res.json()) as Record<string, string[]>;
  },
);

const presenceSlice = createSlice({
  name: 'presence',
  initialState: { onlineByGuild: {}, voiceByChannel: {} } as PresenceState,
  reducers: {
    setGuildPresence(
      state,
      action: PayloadAction<{ guildId: string; userIds: string[] }>,
    ) {
      state.onlineByGuild[action.payload.guildId] = action.payload.userIds;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchVoicePresence.fulfilled, (s, a) => {
      for (const [cid, ids] of Object.entries(a.payload)) {
        s.voiceByChannel[cid] = ids;
      }
    });
  },
});

// ===== TYPING =====
interface TypingState {
  byChannel: Record<string, { userId: string; expiresAt: number }[]>;
}

const typingSlice = createSlice({
  name: 'typing',
  initialState: { byChannel: {} } as TypingState,
  reducers: {
    setTyping(state, action: PayloadAction<{ channelId: string; userId: string }>) {
      const list = state.byChannel[action.payload.channelId] ?? [];
      const filtered = list.filter((t) => t.userId !== action.payload.userId);
      filtered.push({
        userId: action.payload.userId,
        expiresAt: Date.now() + 5000,
      });
      state.byChannel[action.payload.channelId] = filtered;
    },
    pruneTyping(state) {
      const now = Date.now();
      for (const cid of Object.keys(state.byChannel)) {
        state.byChannel[cid] = (state.byChannel[cid] ?? []).filter((t) => t.expiresAt > now);
      }
    },
  },
});

// ===== UI =====
interface UiState {
  showMemberList: boolean;
  mode: 'guild' | 'dm';
  selectedDMChannelId: string | null;
  modal:
    | 'create_guild'
    | 'join_guild'
    | 'invite_link'
    | 'server_settings'
    | 'friends'
    | 'search'
    | 'create_channel'
    | null;
  profileCardUserId: string | null;
  profileCardAnchor: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null;
  // Mesajsız ama açık DM (profil kartından "Mesaj" ile gelinen): sidebar'da "Yeni" rozetli pinned satır
  pendingDM: { channelId: string; partnerId: string } | null;
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    showMemberList: true,
    mode: 'guild',
    selectedDMChannelId: null,
    modal: null,
    profileCardUserId: null,
    profileCardAnchor: null,
    pendingDM: null,
  } as UiState,
  reducers: {
    toggleMemberList(state) {
      state.showMemberList = !state.showMemberList;
    },
    openModal(state, action: PayloadAction<UiState['modal']>) {
      state.modal = action.payload;
    },
    closeModal(state) {
      state.modal = null;
    },
    setMode(state, action: PayloadAction<'guild' | 'dm'>) {
      state.mode = action.payload;
    },
    selectDM(state, action: PayloadAction<string>) {
      state.mode = 'dm';
      state.selectedDMChannelId = action.payload;
    },
    setPendingDM(
      state,
      action: PayloadAction<{ channelId: string; partnerId: string } | null>,
    ) {
      state.pendingDM = action.payload;
    },
    openProfileCard(
      state,
      action: PayloadAction<{ userId: string; anchorRect?: DOMRect | null } | null>,
    ) {
      if (!action.payload) {
        state.profileCardUserId = null;
        state.profileCardAnchor = null;
        return;
      }
      state.profileCardUserId = action.payload.userId;
      const r = action.payload.anchorRect;
      state.profileCardAnchor = r
        ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
        : null;
    },
  },
});

export const { logout } = authSlice.actions;
export const { selectGuild } = guildsSlice.actions;
export const { selectChannel } = channelsSlice.actions;
export const { pushMessage, updateMessage, removeMessage } = messagesSlice.actions;
export const { upsertUser } = usersSlice.actions;
export const { setGuildPresence } = presenceSlice.actions;
export const { setTyping, pruneTyping } = typingSlice.actions;
export const { toggleMemberList, openModal, closeModal, setMode, selectDM, openProfileCard, setPendingDM } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    guilds: guildsSlice.reducer,
    channels: channelsSlice.reducer,
    messages: messagesSlice.reducer,
    members: membersSlice.reducer,
    reactions: reactionsSlice.reducer,
    users: usersSlice.reducer,
    presence: presenceSlice.reducer,
    typing: typingSlice.reducer,
    ui: uiSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
