import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@base-ui/react';
import { ChevronLeft } from 'lucide-react';


export const Route = createFileRoute(
  '/(public)/algoritmos/algoritmos-geneticos',
)({
  component: RouteComponent,
})

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
            <Button onClick={navigateToHome} className='w-fit mb-4 flex justify-center items-center'><ChevronLeft/> Voltar</Button>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <CardTitle>
                <CardHeader className='pl-0 text-bold text-xl'>Algoritmos Geneticos</CardHeader>
              </CardTitle>
            </motion.div>
          </CardHeader>
          <CardContent className='flex flex-col gap-2'>
            <form className='flex flex-col gap-4'>
              <div className='flex flex-col gap-3'>
                <Label>Tamanho do Problema: </Label>
                <Input className='w-112 w-full' placeholder='example: 5'/>
              </div>
              <div className='flex gap-2'>
                <Button className='flex-1'>Gerar Problema</Button>
              </div>
              <Label className='mt-4'>Configuração do Algoritmo: </Label>
              <Card>
                <CardContent className='flex flex-col gap-4'>
                  <div className='flex gap-3'>
                    <Label className='flex-1'>Tamanho da População: </Label>
                    <Input className='flex-1' placeholder='ex: 10'/>
                  </div>
                  <div className='flex gap-3'>
                    <Label className='flex-1'>Taxa de Mutação: </Label>
                    <Input className='flex-1' placeholder='ex: 5'/>
                  </div>
                  <div className='flex gap-3'>
                    <Label className='flex-1'>Taxa de Cruzamento: </Label>
                    <Input className='flex-1' placeholder='ex: 25'/>
                  </div>
                  <div className='flex gap-3'>
                    <Label className='flex-1'>Intervalo de geração: </Label>
                    <Input className='flex-1' placeholder='ex: 2'/>
                  </div>
                  <div className='flex gap-3'>
                    <Label className='flex-1'>Numero de gerações: </Label>
                    <Input className='flex-1' placeholder='ex: 10'/>
                  </div>
                </CardContent>
              </Card>
              <div className='flex gap-2'>
                <Button className='flex-1'>Executar Algoritmo</Button>
              </div>
              <Separator className="border border-primary"/>
              <p className='text-center my-5'>Resultados da Simulaçao Aqui</p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
