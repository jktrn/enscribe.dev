const DiscordPresence = ({ lanyard }) => {
    const mainActivity = lanyard.data.activities.filter(
        (activity) =>
            activity.type === 0 && activity.assets
    )[0]
    console.log(mainActivity)

    return (
        <div className="flex flex-col">
            <img
                className="w-8 h-8 rounded-full"
                src={`https://api.lanyard.rest/${lanyard.data.discord_user.id}.png`}
                alt="Discord Avatar"
            />
            <div className="text-sm font-medium text-white">
                @{lanyard.data.discord_user.username}
            </div>
            <div className="text-xs font-medium text-gray-300">
                {lanyard.data.discord_user.display_name}
            </div>
            <div className="text-xs font-medium text-gray-300">
                {mainActivity.state}
            </div>
            <div className="text-xs font-medium text-gray-300">
                {mainActivity.details}
            </div>
            <div className="text-xs font-medium text-gray-300">
                {mainActivity.assets.large_text}
            </div>
            <img
                className="w-8 h-8 rounded-md"
                src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`}
                alt="Discord Avatar"
            />
            <img
                className="w-8 h-8 rounded-full"
                src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.small_image}.png`}
                alt="Discord Avatar"
            />
        </div>
    )
}

export default DiscordPresence
