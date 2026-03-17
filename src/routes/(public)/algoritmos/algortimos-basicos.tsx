import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@base-ui/react';
import { ChevronLeft } from 'lucide-react';

export const Route = createFileRoute('/(public)/algoritmos/algortimos-basicos')({
	component: RouteComponent,
});

function RouteComponent() {

	const navigate = useNavigate();

	const navigateToHome = () => {
		navigate({to: "/"});
	}

	return (
		<div className='w-screen h-screen flex justify-center items-center'>
			<motion.div>
				<Card>
					<CardHeader>
						<Button onClick={navigateToHome} className='w-fit mb-4'><ChevronLeft/> Voltar</Button>
						<motion.div
							animate={{ y: [0, -5, 0] }}
							transition={{
								duration: 2,
								repeat: Infinity,
								ease: "easeInOut"
							}}
						>
							<CardTitle>
								<CardHeader className='pl-0 text-bold text-xl'>Algoritmos Basicos</CardHeader>
							</CardTitle>
						</motion.div>
					</CardHeader>
					<CardContent className='flex flex-col gap-2'>
						<form className='flex flex-col gap-4'>
							<div className='flex flex-col gap-3'>
								<Label>Tipo de Execução:</Label>
								<Select>
									<SelectTrigger className='w-112'>
										<SelectValue placeholder="Selecione um tipo" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={"aleatorio"}>Aleatoria</SelectItem>
										<SelectItem value={"fixa"}>Fixa</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='flex flex-col gap-3'>
								<Label>Tamanho do Problema: </Label>
								<Input className='w-112' placeholder='example: 5'/>
							</div>
							<div className='flex flex-col gap-3'>
								<Label>Metodos:</Label>
								<Select>
									<SelectTrigger className='w-112'>
										<SelectValue placeholder="Selecione o metodo" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={"aleatorio"}>Subida de Encosta</SelectItem>
										<SelectItem value={"fixa"}>Subida de Encosta com tentativas</SelectItem>
										<SelectItem value={"fixa"}>Tempera Simulada</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='flex gap-2'>
								<Button className='flex-1'>Soluçao inicial</Button>
								<Button className='flex-1'>Gerar Problema</Button>
							</div>
							<Separator className="border border-primary"/>
							<p className='text-center my-5'>Resultados da Simulaçao Aqui</p>
						</form>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
}
