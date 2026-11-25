import Swal from "sweetalert2";

export function showToast(icon, title) {
  const dark = document.documentElement.dataset.theme === "dark";
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
    background: dark ? "#17131f" : "#ffffff",
    color: dark ? "#f0eafa" : "#30283b"
  });
}
