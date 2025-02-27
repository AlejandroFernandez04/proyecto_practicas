package trabajo_practicas;
import java.util.ArrayList;
import java.util.Scanner;

public class trabajo_practicas {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        String[] nombres = new String[100];
        String[] usuarios = new String[100];
        String[] passwords = new String[100];
        int count = 0;
        
        ArrayList<String> listaNombres = new ArrayList<>();
        
        int opcion = 0;
        
        do {
            System.out.println("\n--- MENÚ PRINCIPAL ---");
            System.out.println("1. Registrar usuario");
            System.out.println("2. Iniciar sesión");
            System.out.println("3. Eliminar usuario");
            System.out.println("4. Mostrar usuarios");
            System.out.println("5. Salir");
            System.out.print("Elige una opción: ");
            opcion = sc.nextInt();
            sc.nextLine(); 
            
            switch(opcion) {
                case 1:
                    
                    if (count >= nombres.length) {
                        System.out.println("No se pueden registrar más usuarios (límite alcanzado).");
                    } else {
                        System.out.print("Introduce el nombre completo: ");
                        String nombre = sc.nextLine();
                        
                        System.out.print("Introduce el nombre de usuario: ");
                        String user = sc.nextLine();
                        
                        System.out.print("Introduce la contraseña: ");
                        String pass = sc.nextLine();
                        
                        nombres[count] = nombre;
                        usuarios[count] = user;
                        passwords[count] = pass;
                        
                        listaNombres.add(nombre);
                        count++;
                        
                        System.out.println("Usuario registrado con éxito.");
                    }
                    break;
                    
                case 2:
                    
                    if (count == 0) {
                        System.out.println("No hay usuarios registrados.");
                    } else {
                        System.out.print("Introduce tu nombre de usuario: ");
                        String user = sc.nextLine();
                        
                        System.out.print("Introduce tu contraseña: ");
                        String pass = sc.nextLine();
                        
                        boolean encontrado = false;
                        for (int i = 0; i < count; i++) {
                            if (usuarios[i].equals(user) && passwords[i].equals(pass)) {
                                System.out.println("Inicio de sesión exitoso. ¡Bienvenido/a " + nombres[i] + "!");
                                encontrado = true;
                                break;
                            }
                        }
                        if (!encontrado) {
                            System.out.println("Usuario o contraseña incorrectos.");
                        }
                    }
                    break;
                    
                case 3:
                    
                    if (count == 0) {
                        System.out.println("No hay usuarios registrados para eliminar.");
                    } else {
                        System.out.print("Introduce el nombre de usuario a eliminar: ");
                        String user = sc.nextLine();
                        
                        System.out.print("Introduce la contraseña: ");
                        String pass = sc.nextLine();
                        
                        boolean eliminado = false;
                        for (int i = 0; i < count; i++) {
                            if (usuarios[i].equals(user) && passwords[i].equals(pass)) {
                                String nombreAEliminar = nombres[i];
                                
                                
                                for (int j = i; j < count - 1; j++) {
                                    nombres[j] = nombres[j + 1];
                                    usuarios[j] = usuarios[j + 1];
                                    passwords[j] = passwords[j + 1];
                                }
                                
                                
                                nombres[count - 1] = null;
                                usuarios[count - 1] = null;
                                passwords[count - 1] = null;
                                count--;
                                
                                listaNombres.remove(nombreAEliminar);
                                
                                System.out.println("Usuario eliminado con éxito.");
                                eliminado = true;
                                break;
                            }
                        }
                        if (!eliminado) {
                            System.out.println("No se encontró un usuario con esas credenciales.");
                        }
                    }
                    break;
                    
                case 4:
                    // MOSTRAR USUARIOS
                    if (count == 0) {
                        System.out.println("No hay usuarios registrados.");
                    } else {
                        System.out.println("\n--- LISTA DE USUARIOS REGISTRADOS ---");
                        for (int i = 0; i < count; i++) {
                            System.out.println("[" + i + "] Nombre: " + nombres[i] + ", Usuario: " + usuarios[i]);
                        }
                        
                    }
                    break;
                    
                case 5:
                    System.out.println("Saliendo del programa...");
                    break;
                    
                default:
                    System.out.println("Opción no válida. Intenta de nuevo.");
            }
        } while (opcion != 5);
        
        
    }
}

