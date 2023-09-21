import { FaDiscord } from "react-icons/fa"

const DiscordPresence = ({ lanyard }) => {
    const mainActivity = lanyard.data.activities.filter(
        (activity) =>
            activity.type === 0 && activity.assets
    )[0]
    console.log(mainActivity)

    return (
        <div className="relative w-full h-full flex flex-col">
            <img
                className="absolute top-9 left-4 w-24 h-24 rounded-full"
                src={`https://api.lanyard.rest/${lanyard.data.discord_user.id}.png`}
                alt="Discord Avatar"
            />
            <div className="absolute right-0 top-0 z-[1] w-16 h-16 flex items-center justify-center m-3 rounded-full bg-primary">
                <FaDiscord size={58} className="text-secondary p-1" />
            </div>
            <div className="bg-tertiary/50 w-full h-24 rounded-t-3xl" />
            <div className="my-3 flex w-full h-6">
                <div className="bg-tertiary/50 rounded-md w-[40%] h-full mr-3 ml-auto" />
            </div>
            {/* <div className="text-sm font-medium text-white">
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
            /> */}
        </div>
    )
}

export default DiscordPresence
