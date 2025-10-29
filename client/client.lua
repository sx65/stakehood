--local debugging_enabled = true;

local debug_print = function( msg )
    if ( debugging_enabled ) then
      rconsoleprint( msg );
    end;
  end;
  
  local http_service = game:GetService( 'HttpService' );
  
  local players = game:GetService( 'Players' );
  local replicated_storage = game:GetService( 'ReplicatedStorage' );
  
  local client = players.LocalPlayer;
  local player_gui = client:WaitForChild( 'PlayerGui' );
  
  local event = replicated_storage:FindFirstChildWhichIsA( 'RemoteEvent' );
  
  -- // Request trade
  local request_trade = function( player_name )
    local player = players:WaitForChild( player_name );
  
    if ( not player ) then
      return false;
    end;
  
    local args = {
      [1] = "Trading",
      [2] = "Request",
      [3] = player
    };
  
    event:FireServer( unpack( args ) );
  
    debug_print( 'Sent trade to: ' .. player_name );
  
    return true;
  end;
  
  -- // Ready trade
  local ready_trade = function( )
    local args = {
      [1] = "Trading",
      [2] = "Ready",
      [3] = "",
      [4] = ""
    };
  
    event:FireServer( unpack( args ) );
  
    debug_print( 'Sent ready up request' );
    end;
  
    -- // Confirm trade
    local confirm_trade = function( )
    local args = {
      [1] = "Trading",
      [2] = "Confirm",
      [3] = "",
      [4] = ""
    };
  
    event:FireServer( unpack( args ) );
  
    debug_print( 'Sent confirm request' );
  end;
  
  -- // Add skin
  local add_skin = function( gun_name, skin_name )
    local args = {
      [1] = "Trading",
      [2] = "Add",
      [3] = tostring( gun_name ),
      [4] = tostring( skin_name )
    };
  
    event:FireServer( unpack( args ) );
  
    debug_print( 'Added ' .. gun_name .. ' - ' .. skin_name .. ' to trade' );
    end;
  
    -- // Cancel trade
    local cancel_trade = function( )
    local args = {
      [1] = "Trading",
      [2] = "Cancel",
      [3] = "",
      [4] = ""
    };
  
    event:FireServer( unpack( args ) );
  
    debug_print( 'Cancelled trade' );
  end;
  
  local open_gui = function( )
    local main_screen_gui = player_gui:WaitForChild( 'MainScreenGui' );
    local weapon_skins_gui = main_screen_gui:WaitForChild( 'WeaponSkinsGUI' );
  
    if ( weapon_skins_gui.Visible == true ) then
        return;
    end;
  
    local crew = main_screen_gui:WaitForChild( 'Crew' );
    local bottom_left = crew:WaitForChild( 'BottomLeft' );
    local frame = bottom_left:WaitForChild( 'Frame' );
    local skins = frame:WaitForChild( 'Skins' );
  
    local old_identity = getthreadidentity( );
    setidentity( 5 );
    firesignal( skins.Activated );
    setidentity( old_identity );
  end;
  
  local extract_info = function( text )
      local gun_name = text:match( '%[(.-)%]' );
      local skin_name = text:match( '%].+$' );
  
      if ( skin_name ) then
          skin_name = skin_name:sub( 2 );
      end;
  
      if not gun_name or not skin_name then
          return { nil, nil };
      end;  
  
      gun_name = '[' .. gun_name .. ']';
  
      return { gun_name, skin_name };
  end;
  
  
  local check_pending = function( )
    local resp = request( { 
        Url = 'http://localhost:3000/pending-transactions', 
        Method = 'GET' 
    } );
  
    local parsed = http_service:JSONDecode( resp.Body );
    local pending = parsed.pending;
  
    if ( #pending == 0 ) then
        return false;
    end;
  
    local pending_request = pending[1];
  
    return { 
        username = pending_request.robloxUsername, 
        discord_id = pending_request.discordId,
        type = pending_request.type,
        skins = pending_request.skins
    };
  end;
  
  local send_received = function( data, skins )
    local username = data.username;
    local discord_id = data.discord_id;
    local type = data.type;
  
    local resp = request( { 
        Url = 'http://localhost:3000/received', 
        Method = 'POST', 
        Body = http_service:JSONEncode( { 
            robloxUsername = username, 
            discordId = discord_id, 
            skins = skins, 
            transactionType = type
        } ),
        Headers = {
            ['content-type'] = 'application/json'
        }
    } );
    
    local parsed = http_service:JSONDecode( resp.Body );
    local message = parsed.message;
  
    if ( message == nil ) then
        debug_print( parsed.error );
        return false;
    end;
  
    debug_print( message );
  
    return true;
  end;
  
  local withdraw_skins = function( pending, skins )
    local player_name = pending.username;
  
    debug_print( 'Waiting for player...' );
    repeat task.wait( 1 ) until players:FindFirstChild( player_name );
    debug_print( 'Player is in the server' );
  
    open_gui( );
    debug_print('\n');
  
    task.wait( 3 );
  
    local main_screen_gui = player_gui:WaitForChild( 'MainScreenGui' );
    local weapon_skins_gui = main_screen_gui:WaitForChild( 'WeaponSkinsGUI' );
    local body = weapon_skins_gui:WaitForChild( 'Body' );
    local wrapper = body:WaitForChild( 'Wrapper' );
    local skin_view = wrapper:WaitForChild( 'SkinView' );
    local trading = skin_view:WaitForChild( 'Trading' );
    
    debug_print( 'Waiting for trade request to be accepted...' );
    repeat task.wait( 1 ) 
        request_trade( player_name );
        open_gui( );
    until trading.Visible == true;
    
    debug_print( 'Trade request accepted!\n' );
    task.wait( 2 );
    
    debug_print( 'Adding skins...' );
    for _, v in ipairs( skins ) do
        add_skin( v[1], v[2] );
        task.wait( 2 );
    end;
    debug_print('\n');
    
    local offer1 = trading:WaitForChild( 'Offer1' );
    local offer1_label = offer1:WaitForChild( 'TextLabel' );
    
    repeat task.wait( 0.5 ) 
      if ( offer1_label.TextColor3 ~= Color3.fromRGB( 255, 255, 0 ) ) then
        ready_trade( );
      end;
    until offer1_label.TextColor3 == Color3.fromRGB( 255, 255, 0 );
    
    local offer2 = trading:WaitForChild( 'Offer2' );
    local offer2_label = offer2:WaitForChild( 'TextLabel' );
    
    repeat task.wait( 0.5 ) until offer2_label.TextColor3 == Color3.fromRGB( 255, 255, 0 );
    
    task.wait( 1 );
    
    confirm_trade( );
    
    repeat task.wait( 1 ) until trading.Visible == false;
    
    debug_print( 'Trade completed!' );
  
    local request_skins = {};
  
    for i = 1, #skins do
      request_skins[ #request_skins + 1 ] = skins[i][1] .. skins[i][2];
    end;
  
    send_received( pending, request_skins );
  end;
  
  local deposit_skins = function( pending )
    local player_name = pending.username;
  
    debug_print( 'Waiting for player...' );
    repeat task.wait( 1 ) until players:FindFirstChild( player_name );
    debug_print( 'Player is in the server' );
  
    open_gui( );
    debug_print('\n');
  
    task.wait( 3 );
  
    local main_screen_gui = player_gui:WaitForChild( 'MainScreenGui' );
    local weapon_skins_gui = main_screen_gui:WaitForChild( 'WeaponSkinsGUI' );
    local body = weapon_skins_gui:WaitForChild( 'Body' );
    local wrapper = body:WaitForChild( 'Wrapper' );
    local skin_view = wrapper:WaitForChild( 'SkinView' );
    local trading = skin_view:WaitForChild( 'Trading' );
    
    debug_print( 'Waiting for trade request to be accepted...' );
    repeat task.wait( 1 ) 
        request_trade( player_name );
        open_gui( );
    until trading.Visible == true;
    
    debug_print( 'Trade request accepted!\n' );
    task.wait( 2 );
    
    debug_print( 'Waiting for skins to be added...' );
    
    local offer2 = trading:WaitForChild( 'Offer2' );
    local offer2_label = offer2:WaitForChild( 'TextLabel' );
    
    repeat task.wait( 0.5 ) until offer2_label.TextColor3 == Color3.fromRGB( 255, 255, 0 );
  
    local frame = offer2:WaitForChild( 'Frame' );
    local scrolling_frame = frame:WaitForChild( 'ScrollingFrame' );
  
    local added_skins = { };
  
    for i, v in pairs( scrolling_frame:GetChildren()) do
        if ( v.ClassName ~= 'Frame' ) then
            continue;
        end;
  
        local gun_info = extract_info( v.Name );
  
        if ( gun_info[1] == nil or gun_info[2] == nil ) then
            continue;
        end;
  
        added_skins[#added_skins + 1] = gun_info;
    end;
  
    task.wait( 0.5 );
    ready_trade( );
    task.wait( 1 );
    confirm_trade( );
  
    repeat task.wait( 0.5 ) until trading.Visible == false;
  
    local request_skins = {};
  
    for i = 1, #added_skins do
      request_skins[ #request_skins + 1 ] = added_skins[i][1] .. added_skins[i][2];
    end;
  
    send_received( pending, request_skins );
  end;
  ----------------------------------------
  while task.wait( 1 ) do
    debug_print( 'Checking pending...' )
  
    local pending = check_pending( );
  
    if ( pending == false ) then
        continue;
    end;
  
    debug_print( 'Received request' );
  
    if ( pending.type == 'deposit' ) then
        deposit_skins( pending );
    elseif ( pending.type == 'withdraw' ) then
        local skins = {};
  
        for _, v in ipairs( pending.skins ) do
            local gun_info = extract_info( v );
  
            if ( gun_info[1] == nil or gun_info[2] == nil ) then
                continue;
            end;
  
            skins[ #skins + 1 ] = { gun_info[1], gun_info[2] };
        end;
  
        withdraw_skins( pending, skins );
    end;
  end;