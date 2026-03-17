import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { motion } from 'framer-motion';

export const Route = createFileRoute('/(public)/')({
	component: LandingPage
});

function LandingPage() {
	const navigate = useNavigate();

	const redirectToBasicAlgorithims = () => {
		navigate({to: "/algoritmos/algortimos-basicos"});
	}

	const redirectToGeneticAlgorithims = () => {
		navigate({to: "/algoritmos/algoritmos-geneticos"});
	}

	return (
		<div className='w-screen h-screen flex justify-center items-center'>
			<motion.div
				animate={{ y: [0, -13, 0] }}
				transition={{
					duration: 2,
					repeat: Infinity,
					ease: "easeInOut"
				}}
			>
				<Card>
					<CardHeader>
						<CardTitle>
							<CardHeader className='pl-0 text-bold text-xl'>Menu</CardHeader>
							<CardDescription>Escolha o tipo de algoritmo desejado.</CardDescription>
						</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-col gap-2'>
						<Button className='w-112' onClick={redirectToBasicAlgorithims}>Algoritmos Basicos</Button>
						<Button className='w-112' onClick={redirectToGeneticAlgorithims}>Algoritmos Genéticos</Button>
					</CardContent>
					<CardFooter>
						<Button className='w-112' variant={"secondary"}>Sobre o Sistema</Button>
					</CardFooter>
				</Card>
			</motion.div>
		</div>
	);
}