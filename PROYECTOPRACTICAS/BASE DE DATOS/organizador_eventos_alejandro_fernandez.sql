drop database if exists organizador_eventos;
create database organizador_eventos;
use organizador_eventos;

create table usuarios(
id_usuario int auto_increment primary key,
nombre varchar(100),
correo varchar(100),
contraseña varchar(100)
);

create table inscripcion(
id_inscripcion int auto_increment primary key,
fecha date,
id_usuario int references usuarios(id_usuario),
id_eventos int references eventos(id_eventos)
);

create table organizador(
id_organizador int auto_increment primary key,
correo varchar(100),
contraseña varchar(100),
telefono int
);


create table eventos(
id_eventos int auto_increment primary key,
nombre varchar(100),
fecha_inicio date,
duracion varchar(100),
lugar varchar(50),
id_organizador int references organizador(id_organizador),
id_inscripcion int references inscripcion(id_inscripcion)
);

create table taller(
id_taller int auto_increment primary key,
id_eventos int references eventos(id_eventos) ON DELETE CASCADE
);

create table conferencias(
id_conferencias int auto_increment primary key,
id_eventos int references eventos(id_eventos) ON DELETE CASCADE
);

create table actividades(
id_actividades int auto_increment primary key,
id_eventos int references eventos(id_eventos) ON DELETE CASCADE
);
