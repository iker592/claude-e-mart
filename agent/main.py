import asyncio

from basic_agent import main as basic_agent_main    

async def main():
    await basic_agent_main()

if __name__ == "__main__":
    asyncio.run(main())